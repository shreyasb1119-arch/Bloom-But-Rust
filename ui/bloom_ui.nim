## Bloom UI, phase 0: the notch as a native Nim window (no WebView2).
##
## Windowing is Windy, drawing is Pixie into one image that Boxy puts on the
## GPU. That is the same stack Fidget is built on. All data comes from the Rust
## backend DLL (bloom_backend.dll) through two functions.

import std/[json, math, os, strutils, times]
import windy, boxy, opengl, pixie, vmath

const
  WinW = 440
  WinH = 230
  Title = "Bloom Nim Notch"
  CollapsedW = 190'f32
  CollapsedH = 34'f32
  ExpandedW = 400'f32
  ExpandedH = 176'f32
  FontRegular = r"C:\Windows\Fonts\segoeui.ttf"
  FontSemibold = r"C:\Windows\Fonts\seguisb.ttf"
  Weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  Months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# ---------------------------------------------------------------- Rust backend

proc bloomCall(request: cstring): cstring
  {.cdecl, importc: "bloom_call", dynlib: "bloom_backend.dll".}
proc bloomFree(s: cstring)
  {.cdecl, importc: "bloom_free", dynlib: "bloom_backend.dll".}

proc backend(request: string): JsonNode =
  let raw = bloomCall(request.cstring)
  if raw == nil:
    return newJNull()
  let text = $raw
  bloomFree(raw)
  try:
    result = parseJson(text)
  except CatchableError:
    result = newJNull()

# ----------------------------------------------------------------- Win32 bits

type CursorPoint = object
  x, y: int32

proc FindWindowA(cls: pointer, title: cstring): int
  {.stdcall, dynlib: "user32", importc.}
proc GetWindowLongPtrW(hwnd: int, index: int32): int
  {.stdcall, dynlib: "user32", importc.}
proc SetWindowLongPtrW(hwnd: int, index: int32, value: int): int
  {.stdcall, dynlib: "user32", importc.}
proc SetWindowPos(hwnd: int, after: int, x, y, cx, cy: int32, flags: uint32): int32
  {.stdcall, dynlib: "user32", importc.}
proc SetLayeredWindowAttributes(hwnd: int, key: uint32, alpha: uint8, flags: uint32): int32
  {.stdcall, dynlib: "user32", importc.}
proc GetCursorPos(p: ptr CursorPoint): int32
  {.stdcall, dynlib: "user32", importc.}
proc GetSystemMetrics(index: int32): int32
  {.stdcall, dynlib: "user32", importc.}

const
  GwlExStyle = -20'i32
  WsExTransparent = 0x20
  WsExToolWindow = 0x80
  WsExLayered = 0x80000
  WsExNoActivate = 0x08000000
  LwaAlpha = 2'u32
  HwndTopmost = -1
  SwpNoSize = 0x1'u32
  SwpNoMove = 0x2'u32
  SwpNoActivate = 0x10'u32
  SwpFrameChanged = 0x20'u32

proc makeOverlay(clickThrough: bool) =
  ## Keeps the window off the taskbar, on top and focus-free, and optionally
  ## lets clicks fall through to the apps underneath.
  let hwnd = FindWindowA(nil, Title.cstring)
  if hwnd == 0:
    return
  var style = GetWindowLongPtrW(hwnd, GwlExStyle)
  style = style or WsExToolWindow or WsExNoActivate
  if clickThrough:
    style = style or WsExLayered or WsExTransparent
  discard SetWindowLongPtrW(hwnd, GwlExStyle, style)
  if clickThrough:
    discard SetLayeredWindowAttributes(hwnd, 0, 255, LwaAlpha)
  discard SetWindowPos(hwnd, HwndTopmost, 0, 0, 0, 0,
    SwpNoMove or SwpNoSize or SwpNoActivate or SwpFrameChanged)

# ---------------------------------------------------------------------- state

type State = object
  progress, target: float32 ## 0 = collapsed pill, 1 = expanded
  timeText, dateText, captionText: string
  cpuText, ramText, batteryText: string
  cpu, ram, battery: float32
  charging: bool
  dirty: bool

proc refresh(st: var State) =
  let data = backend("""{"cmd":"snapshot"}""")
  if data.kind != JObject:
    return
  let hour = data{"hour"}.getInt(0)
  let minute = data{"minute"}.getInt(0)
  let hour12 = if hour mod 12 == 0: 12 else: hour mod 12
  st.timeText = $hour12 & ":" & align($minute, 2, '0') & (if hour < 12: " AM" else: " PM")
  let weekday = clamp(data{"weekday"}.getInt(0), 0, 6)
  let month = clamp(data{"month"}.getInt(1), 1, 12)
  st.dateText = Weekdays[weekday] & ", " & Months[month - 1] & " " & $data{"day"}.getInt(1)

  st.cpu = data{"cpu"}.getFloat(0.0).float32
  st.cpuText = $int(round(st.cpu)) & "%"
  st.ram = data{"ram"}.getFloat(0.0).float32
  st.ramText = $int(round(st.ram)) & "%"

  var caption = ""
  let battery = data{"battery"}
  if not battery.isNil and battery.kind == JObject:
    st.battery = battery{"percent"}.getFloat(100.0).float32
    st.batteryText = $int(round(st.battery)) & "%"
    st.charging = battery{"charging"}.getBool(false)
    if st.charging:
      caption = "Charging · "
  else:
    st.battery = 100
    st.batteryText = "n/a"
    st.charging = false
  caption &= "This program uses " & $int(round(data{"memMb"}.getFloat(0.0))) & " MB"
  st.captionText = caption
  st.dirty = true

# -------------------------------------------------------------------- drawing

var
  fontRegular: Font
  fontSemibold: Font

proc drawText(img: Image, font: Font, size: float32, text: string,
              x, y, w, h: float32, col: Color, hAlign = CenterAlign) =
  font.size = size
  font.paint.color = col
  img.fillText(font.typeset(text, vec2(w, h), hAlign, MiddleAlign),
    translate(vec2(x, y)))

proc fillRounded(img: Image, x, y, w, h, r: float32, col: Color) =
  let path = newPath()
  path.roundedRect(x, y, w, h, r, r, r, r)
  img.fillPath(path, col)

proc fillPill(img: Image, x, y, w, h, r: float32, col: Color) =
  ## Square top corners (they meet the screen edge), round bottom corners.
  let path = newPath()
  path.roundedRect(x, y, w, h, 0, 0, r, r)
  img.fillPath(path, col)

proc withAlpha(c: Color, a: float32): Color =
  color(c.r, c.g, c.b, c.a * a)

proc drawBar(img: Image, x, y, w: float32, label, valueText: string,
             value: float32, tint: Color, alpha: float32) =
  img.drawText(fontRegular, 11, label, x, y, 34, 16, color(1, 1, 1, 0.7 * alpha), LeftAlign)
  let trackX = x + 38
  let trackW = w - 38 - 42
  img.fillRounded(trackX, y + 5, trackW, 6, 3, color(1, 1, 1, 0.15 * alpha))
  let fillW = trackW * clamp(value, 0, 100) / 100
  if fillW > 1:
    img.fillRounded(trackX, y + 5, fillW, 6, 3, tint.withAlpha(alpha))
  img.drawText(fontRegular, 11, valueText, x + w - 38, y, 38, 16, color(1, 1, 1, alpha), RightAlign)

proc mix(a, b, t: float32): float32 =
  a + (b - a) * t

proc compose(canvas: Image, st: State) =
  canvas.fill(rgba(0, 0, 0, 0))
  let p = st.progress
  let pw = mix(CollapsedW, ExpandedW, p)
  let ph = mix(CollapsedH, ExpandedH, p)
  let x = (WinW.float32 - pw) / 2
  canvas.fillPill(x, 0, pw, ph, 22, color(0, 0, 0, 1))
  canvas.drawText(fontSemibold, 13, st.timeText, x, 0, pw, CollapsedH, color(1, 1, 1, 1))

  let alpha = clamp((p - 0.2) / 0.8, 0, 1)
  if alpha > 0.01:
    let inner = x + 14
    let innerW = pw - 28
    canvas.drawText(fontRegular, 11, st.dateText, inner, 38, innerW, 16,
      color(1, 1, 1, 0.7 * alpha))
    canvas.drawBar(inner, 66, innerW, "CPU", st.cpuText, st.cpu, color(0.04, 0.52, 1, 1), alpha)
    canvas.drawBar(inner, 90, innerW, "RAM", st.ramText, st.ram, color(0.04, 0.52, 1, 1), alpha)
    let batteryTint =
      if st.charging: color(0.2, 0.84, 0.29, 1)
      elif st.battery < 20: color(1, 0.27, 0.23, 1)
      else: color(1, 1, 1, 1)
    canvas.drawBar(inner, 114, innerW, "BAT", st.batteryText, st.battery, batteryTint, alpha)
    canvas.drawText(fontRegular, 10, st.captionText, inner, 142, innerW, 16,
      color(1, 1, 1, 0.5 * alpha))

# ----------------------------------------------------------------------- main

proc main() =
  let clickThrough = "--no-clickthrough" notin commandLineParams()

  let window = newWindow(Title, ivec2(WinW, WinH), style = Transparent)
  makeContextCurrent(window)
  loadExtensions()
  let bxy = newBoxy()

  fontRegular = readFont(FontRegular)
  fontSemibold = readFont(FontSemibold)
  let canvas = newImage(WinW, WinH)

  window.pos = ivec2(max(0, (GetSystemMetrics(0) - WinW) div 2), 0)
  makeOverlay(clickThrough)

  var st = State(battery: 100, dirty: true)
  refresh(st)
  var lastStats = epochTime()
  var uploaded = false

  while not window.closeRequested:
    pollEvents()

    # The window ignores the mouse, so hover comes from the cursor position.
    var cursor: CursorPoint
    if GetCursorPos(addr cursor) != 0:
      let pw = mix(CollapsedW, ExpandedW, st.progress)
      let ph = mix(CollapsedH, ExpandedH, st.progress) + 6
      let left = window.pos.x.float32 + (WinW.float32 - pw) / 2
      let top = window.pos.y.float32
      let inside = cursor.x.float32 >= left and cursor.x.float32 <= left + pw and
                   cursor.y.float32 >= top and cursor.y.float32 <= top + ph
      st.target = if inside: 1 else: 0

    let animating = abs(st.target - st.progress) > 0.002
    if animating:
      st.progress += (st.target - st.progress) * 0.2
      if abs(st.target - st.progress) <= 0.002:
        st.progress = st.target
      st.dirty = true

    let now = epochTime()
    if now - lastStats >= 2.0:
      refresh(st)
      lastStats = now

    if st.dirty:
      compose(canvas, st)
      if uploaded:
        bxy.removeImage("ui")
      bxy.addImage("ui", canvas, genMipmaps = false)
      uploaded = true
      bxy.beginFrame(window.size)
      bxy.drawImage("ui", pos = vec2(0, 0))
      bxy.endFrame()
      window.swapBuffers()
      st.dirty = false

    # Redraw smoothly only while animating; otherwise stay nearly idle.
    sleep(if animating: 8 else: 33)

main()

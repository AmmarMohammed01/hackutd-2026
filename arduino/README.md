# Signboard console

This folder is the Arduino App Lab app for the Uno Q. The laptop runs the game. This app only displays the letter and drives the LEDs.

- Green LED: pin 12, series resistor, other side to GND.
- Red LED: pin 13, series resistor, other side to GND.
- SSD1306 128x64 on SDA and SCL. Default address is `0x3C`. If the screen stays blank, uncomment `u8g2.setI2CAddress(0x3D << 1)` in `sketch/sketch.ino`.

`python/main.py` listens on port 8765.

- `POST /prompt` with `{"letter": "A"}` clears the LEDs and draws the letter.
- `POST /result` with `{"outcome": "correct"}` or `{"outcome": "wrong"}` lights one LED.
- `GET /health` reports the current letter.

From the Mac, with the board on USB:

```sh
adb forward tcp:8765 tcp:8765
```

Running `python3 python/main.py` on the laptop starts a mock that prints the same states. Stop it before `adb forward`, because both want port 8765.

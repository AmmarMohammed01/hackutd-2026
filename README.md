# Signboard

A local ASL alphabet game for HackUTD 2026. One Arduino Uno Q is the family console. Each person picks a name on the laptop, the laptop camera checks the sign, and the board shows the letter plus a green or red light.

The deck is ten static letters: A, B, C, D, F, I, L, V, W, Y. J and Z move, and several other letters look too similar to trust in a live demo. If the camera sees no hand, or a pose that is not a confident letter, nothing scores and neither LED turns on.

## Run the demo

The game stays on the MacBook. Campus Wi-Fi is not part of the loop.

```sh
./run.sh
```

Open http://127.0.0.1:8000. The first build needs network access so it can install packages and download the hand model. After that, the page and the model load from disk.

Without the board, the site still plays. The panel on the right is the on-screen console.

To see the same messages in a terminal instead of on the OLED:

```sh
python3 arduino/python/main.py
```

Stop that mock before forwarding the real board onto port 8765. Only one of them can own the port.

## Wire the Uno Q

SSD1306 128x64, I2C address `0x3C`:

- VCC and GND to the matching header pins. Follow the labels on the module.
- SDA to SDA, SCL to SCL.

LEDs, each with a series resistor of about 220 ohms, other leg to GND. They turn on when the pin is high.

- Green LED on pin 12.
- Red LED on pin 13.

## Run the board app

The firmware lives in [`arduino/`](arduino/) as an Arduino App Lab app.

1. Finish the Uno Q's first setup in Arduino App Lab, over USB.
2. Import the `arduino` folder, or create a blank app and copy in `app.yaml`, `python/main.py`, `sketch/sketch.ino`, and `sketch/sketch.yaml`.
3. If the sketch build cannot find U8g2, add it from the sketch libraries panel. The OLED should then read SIGNBOARD, with both LEDs off.
4. Keep the USB-C data cable connected and forward the console port:

```sh
adb forward tcp:8765 tcp:8765
```

The site badge changes to "Board linked" when that port answers. Power the board the way the hackathon kit expects. A bare MacBook port may not be enough if a display dongle is also attached.

Do not point the laptop and the board at each other over university Wi-Fi. That network is crowded and often blocks device discovery.

## Judging pass

1. Enter a name. Learn mode shows the hand diagram and the letter.
2. Hold the sign until the amber bar fills. A match lights green. A different confident letter lights red and then shows the diagram.
3. Switch to Recall. The diagram stays hidden until the attempt ends.
4. Wave or make a fist that is not one of the ten letters. Neither light should come on.
5. Switch player and show that the second name has its own score.

## Hosting later

This demo is SQLite on the laptop plus USB to the board. A hosted version would be a small app server and Postgres (Fly.io or any always-on VM). Recognition would still run on the player's computer. Do not move the live demo into the cloud.

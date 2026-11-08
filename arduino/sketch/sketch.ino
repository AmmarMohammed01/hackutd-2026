#include <Arduino_RouterBridge.h>
#include <U8g2lib.h>
#include <Wire.h>

// 128x64 SSD1306 on the hardware I2C pins (SDA / SCL), address 0x3C.
// If the module is the 0x3D variant, uncomment the setI2CAddress line in setup.
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

const int kGreenLed = 12;
const int kRedLed = 13;

String letter = "-";
String banner = "";
bool registered = false;

void paint() {
  u8g2.clearBuffer();
  if (letter == "-") {
    u8g2.setFont(u8g2_font_6x12_tr);
    const char *ready = "SIGNBOARD";
    int width = u8g2.getStrWidth(ready);
    u8g2.drawStr((128 - width) / 2, 36, ready);
  } else {
    u8g2.setFont(u8g2_font_logisoso32_tr);
    int width = u8g2.getStrWidth(letter.c_str());
    int x = (128 - width) / 2;
    if (x < 0) x = 0;
    u8g2.drawStr(x, banner.length() ? 40 : 50, letter.c_str());
    if (banner.length()) {
      u8g2.setFont(u8g2_font_6x12_tr);
      int bannerWidth = u8g2.getStrWidth(banner.c_str());
      int bannerX = (128 - bannerWidth) / 2;
      if (bannerX < 0) bannerX = 0;
      u8g2.drawStr(bannerX, 62, banner.c_str());
    }
  }
  u8g2.sendBuffer();
}

void setLeds(bool greenOn, bool redOn) {
  digitalWrite(kGreenLed, greenOn ? HIGH : LOW);
  digitalWrite(kRedLed, redOn ? HIGH : LOW);
}

bool show_letter(String next) {
  next.trim();
  if (next.length() == 0) {
    letter = "-";
  } else {
    letter = next.substring(0, 1);
    letter.toUpperCase();
  }
  banner = "";
  setLeds(false, false);
  paint();
  return true;
}

bool show_result(String outcome) {
  outcome.trim();
  outcome.toLowerCase();
  if (outcome == "correct") {
    banner = "CORRECT";
    setLeds(true, false);
  } else if (outcome == "wrong") {
    banner = "TRY AGAIN";
    setLeds(false, true);
  } else {
    banner = "";
    setLeds(false, false);
  }
  paint();
  return true;
}

void tryRegister() {
  if (registered) return;
  if (!Bridge.begin()) return;
  bool letterOk = Bridge.provide_safe("show_letter", show_letter);
  bool resultOk = Bridge.provide_safe("show_result", show_result);
  registered = letterOk && resultOk;
}

void setup() {
  pinMode(kGreenLed, OUTPUT);
  pinMode(kRedLed, OUTPUT);
  setLeds(false, false);

  // u8g2.setI2CAddress(0x3D << 1);
  u8g2.begin();
  paint();
  tryRegister();
}

void loop() {
  tryRegister();
  delay(20);
}

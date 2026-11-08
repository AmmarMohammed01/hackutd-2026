
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <U8g2lib.h>


// This configures the library for a standard 128x64 SSD1306 display using hardware I2C
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);

const int redLED = 13;
const int greenLED = 12;
bool userSuccess = false;

void setup() {
  // put your setup code here, to run once:

  pinMode(redLED, OUTPUT);
  pinMode(greenLED, OUTPUT);
  
  u8g2.begin();
  
  Serial.begin(9600);
  
}

void loop() {
  // put your main code here, to run repeatedly:

  if(userSuccess == false)
  {
    digitalWrite(redLED, HIGH);
    digitalWrite(greenLED, LOW);
  }
  else
  {
    digitalWrite(redLED, LOW);
    digitalWrite(greenLED, HIGH);
  }

  u8g2.clearBuffer();                   // Clear internal memory
  u8g2.setFont(u8g2_font_ncenB08_tr);   // Choose a clean, readable font
  u8g2.drawStr(0, 12, "Hello, World!"); // Draw text (X=0, Y=12)
  u8g2.drawStr(0, 28, "Arduino Uno Q"); // Draw text (X=0, Y=28)
  u8g2.sendBuffer();                    // Push memory to physical screen
  delay(2000);
  
}

int TEMP = A1;
double analogValue = 0;
float calibration = 0.1039;

void setup() {
    pinMode(TEMP, INPUT);
    Particle.variable("analogValue", analogValue);
}

void loop() {
    analogValue = (((analogRead(TEMP) * 3.3) / 4095) - 0.5) * 100;
    delay(500);
}
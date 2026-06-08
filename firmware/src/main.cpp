#include <Arduino.h>
#include <WiFiManager.h>
#include <WebSocketsClient.h>

// PIN CONFIGURATION
#define TRIG_PIN 5
#define ECHO_PIN 18
#define LED_PIN 19
#define BUZZER_PIN 21

// WEBSOCKET CONFIGURATION
// Deployed Railway backend URL (no https://, no trailing slash)
const char* ws_host = "ftcminigame-production.up.railway.app";
const uint16_t ws_port = 8000;
const char* ws_path = "/ws";

WebSocketsClient webSocket;

// GAME CONFIGURATION
const int DISTANCE_THRESHOLD_CM = 15; // Distance to detect an artifact in the goal
const unsigned long COOLDOWN_MS = 1000; // Cooldown between scores

unsigned long lastScoreTime = 0;

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.println("[WS] Disconnected!");
            break;
        case WStype_CONNECTED:
            Serial.printf("[WS] Connected to url: %s\n", payload);
            break;
        case WStype_TEXT:
            Serial.printf("[WS] Message: %s\n", payload);
            break;
    }
}

void triggerScoreEffect() {
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
}

void setup() {
    Serial.begin(115200);
    
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    pinMode(LED_PIN, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    
    // Ensure outputs are OFF initially
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);

    // WiFiManager Setup
    WiFiManager wm;
    bool res = wm.autoConnect("FTC-Goal-Detector", "password123");
    
    if(!res) {
        Serial.println("Failed to connect to WiFi");
        // ESP.restart();
    } else {
        Serial.println("WiFi connected successfully!");
    }

    // Initialize WebSocket (Using SSL/WSS — required for Railway's HTTPS-only public domains)
    // For local testing without SSL, use webSocket.begin(ws_host, 80, ws_path);
    webSocket.beginSSL(ws_host, 443, ws_path);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
}

void loop() {
    webSocket.loop();

    // Read Ultrasonic Sensor
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
    if (duration > 0) {
        float distance_cm = duration * 0.034 / 2;
        
        // Detect Score
        if (distance_cm > 0 && distance_cm < DISTANCE_THRESHOLD_CM) {
            unsigned long currentTime = millis();
            if (currentTime - lastScoreTime > COOLDOWN_MS) {
                lastScoreTime = currentTime;
                
                Serial.printf("Score Detected! Distance: %.2f cm\n", distance_cm);
                
                // Trigger Hardware Effects
                triggerScoreEffect();
                
                // Send Score via WebSocket
                if (webSocket.isConnected()) {
                    webSocket.sendTXT("SCORE");
                } else {
                    Serial.println("WebSocket disconnected, score not sent!");
                }
            }
        }
    }
    
    delay(50); // Small delay to prevent sensor flooding
}

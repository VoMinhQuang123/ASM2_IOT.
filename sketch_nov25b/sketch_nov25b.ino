#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>
#include <NewPing.h>
#include <Servo.h>

const char* ssid = "wakanai";       
const char* password = "Quang123@@@";  
const char* serverUrl = "http://192.168.0.109:8000/distance";

ESP8266WebServer server(80);

const int trigPin1 = 13;  
const int echoPin1 = 15; 
const int maxDistance1 = 200;  
NewPing sonar1(trigPin1, echoPin1, maxDistance1); 

const int trigPin2 = 14;  
const int echoPin2 = 12; 
const int maxDistance2 = 200;  
NewPing sonar2(trigPin2, echoPin2, maxDistance2); 

bool Continue = false;
bool hasRequest = false;
bool squareDetectedGlobal = false;
String colorDetectedGlobal = ""; 

Servo Servo1;
Servo Servo2;
Servo Servo3;


void sendServer(int distance){
  HTTPClient http;
  WiFiClient client;
  http.begin(client, serverUrl);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  String postData = "distance=" + String(distance);
  int httpResponseCode = http.POST(postData);
  if (httpResponseCode > 0) {
    Serial.println(distance);
  } else {
    Serial.println("Error sending data: " + String(httpResponseCode));
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");
  Serial.println(WiFi.localIP());

  Servo1.attach(4);
  Servo2.attach(0);
  Servo3.attach(2);


  server.on("/result", HTTP_POST, handlePostRequest);
  server.begin();
}

void loop() {
  server.handleClient();
  long distance = sonar1.ping_cm();
   
  if(Continue == false){
    if (distance > 0 && distance < 4) 
    {
    sendServer(distance);
    Continue = true;
    delay(1000);
    } 
    else 
    {
      Serial.println("Không đo được khoảng cách.");
    }
  }
  if(hasRequest){
    if(squareDetectedGlobal == true){
        Servo1.write(0);
        delay(1001);
        Servo1.write(90);
        hasRequest = false;
    }
    else{
      Servo1.write(180);
        delay(1001);
        Servo1.write(90);
        hasRequest = false;
    }
  }
  long distance2 = sonar2.ping_cm();
  if(squareDetectedGlobal == true){
    if(colorDetectedGlobal == "yellow" || colorDetectedGlobal == "orange" || colorDetectedGlobal == "red"){
      if(distance2 == 3){
        Servo2.write(0);
        delay(2001);
        Servo2.write(90);
        Serial.println(" rac loai 1");
        squareDetectedGlobal = false;
        colorDetectedGlobal = "";
        Continue = false;
      }
    }
    if(colorDetectedGlobal == "green" || colorDetectedGlobal == "blue"){
      if(distance2 == 3){
        Servo3.write(0);
        delay(2001);
        Servo3.write(90);
        Serial.println(" rac loai 2");
        squareDetectedGlobal = false;
        colorDetectedGlobal = "";
        Continue = false;
      }
    }
  }
}

void handlePostRequest() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  if (server.hasArg("plain")) {
    String body = server.arg("plain");

    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, body);
    
    if (error) {
      Serial.println("Failed to parse JSON");
      server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"Invalid JSON\"}");
      return;
    }

    squareDetectedGlobal = doc["squareDetected"];
    colorDetectedGlobal = doc["colorDetected"].as<String>();
    hasRequest = true;

    if (squareDetectedGlobal) {
      Serial.println("Hình vuông phát hiện");
    } else {
      Serial.println("Không phát hiện hình vuông");
    }
    Serial.println("Màu sắc: " + colorDetectedGlobal);

    // Phản hồi lại client
    server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Data received\"}");
  } else {
    server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"No data received\"}");
  }
}


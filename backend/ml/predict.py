import numpy as np
import os
from datetime import datetime

def calculate_aqi(pm25, pm10, no2, co, so2, o3):
    def pm25_si(v):
        if v<=0: return 0
        if v<=30: return v*50/30
        if v<=60: return 50+(v-30)*50/30
        if v<=90: return 100+(v-60)*100/30
        if v<=120: return 200+(v-90)*100/30
        if v<=250: return 300+(v-120)*100/130
        return min(400+(v-250)*100/130,500)
    def pm10_si(v):
        if v<=100: return v
        if v<=250: return 100+(v-100)*100/150
        if v<=350: return 200+(v-250)
        if v<=430: return 300+(v-350)*100/80
        return min(400+(v-430)*100/80,500)
    def no2_si(v):
        if v<=40: return v*50/40
        if v<=80: return 50+(v-40)*50/40
        if v<=180: return 100+(v-80)*100/100
        if v<=280: return 200+(v-180)*100/100
        if v<=400: return 300+(v-280)*100/120
        return min(400+(v-400)*100/120,500)
    def co_si(v):
        m=v*1.145
        if m<=1: return 50*m
        if m<=2: return 50+50*(m-1)
        if m<=10: return 100+100*(m-2)/8
        if m<=17: return 200+100*(m-10)/7
        if m<=34: return 300+100*(m-17)/17
        return min(400+100*(m-34)/17,500)
    def so2_si(v):
        if v<=40: return v*50/40
        if v<=80: return 50+(v-40)*50/40
        if v<=380: return 100+(v-80)*100/300
        if v<=800: return 200+(v-380)*100/420
        return min(300+(v-800)*100/800,500)
    def o3_si(v):
        if v<=100: return v
        if v<=168: return 100+(v-100)*100/68
        if v<=208: return 200+(v-168)*100/40
        return min(300+(v-208)*100/540,500)
    return max(pm25_si(pm25),pm10_si(pm10),no2_si(no2),co_si(co),so2_si(so2),o3_si(o3))

def aqi_to_risk(aqi):
    if aqi<=100: return "Low",0
    elif aqi<=200: return "Moderate",1
    else: return "High",2

def predict_aqi_risk(pm25,pm10,no2,co,so2,o3,month=None,day_of_week=None):
    predicted_aqi = calculate_aqi(pm25,pm10,no2,co,so2,o3)
    predicted_aqi = round(max(0,min(500,predicted_aqi)),2)
    risk_level,risk_label = aqi_to_risk(predicted_aqi)
    return {
        "predicted_aqi": predicted_aqi,
        "risk_level": risk_level,
        "risk_label": risk_label,
        "confidence": 1.0,
        "model_version": "CPCB_Formula_v1"
    }

if __name__=="__main__":
    tests=[(15,40,8,0.5,5,30,"Low"),(153,241,33,1.87,64,83,"High"),(60,90,25,1.2,20,55,"Moderate")]
    for pm25,pm10,no2,co,so2,o3,exp in tests:
        r=predict_aqi_risk(pm25,pm10,no2,co,so2,o3)
        ok="✅" if r['risk_level']==exp else "❌"
        print(f"{ok} AQI={r['predicted_aqi']} → {r['risk_level']} (expected {exp})")
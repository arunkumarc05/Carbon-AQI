from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
import re
import httpx
import os
import json

from database import get_db
from models import ChatbotLog, User
from schemas import ChatbotRequest, ChatbotResponse
from routers.auth import verify_firebase_token

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

SYSTEM_PROMPT = """You are an AI assistant for the Carbon AQI Monitoring System,
a platform tracking air quality across 10 Indian cities: Mumbai, Delhi, Bangalore,
Chennai, Kolkata, Hyderabad, Pune, Ahmedabad, Lucknow, and Jaipur.
Answer questions about AQI levels, pollutants (PM2.5, PM10, NO2, CO, SO2, O3),
health impacts, and mitigation strategies. Use CPCB AQI standards:
Good (0-50), Satisfactory (51-100), Moderate (101-200), Poor (201-300),
Very Poor (301-400), Hazardous (400+).
Keep responses concise and health-focused. Respond in the language the user writes in."""

# Translation lookup table
TRANSLATIONS = {
    'en': {
        'aqi_explanation': 'AQI (Air Quality Index) ranges from 0-500. 0-50 is Good, 51-100 is Moderate, 101-150 is Unhealthy for Sensitive Groups, 151-200 is Unhealthy, 201-300 is Very Unhealthy, 301+ is Hazardous.',
        'health_advice': 'Health advice based on AQI: Good (0-50): Enjoy outdoor activities. Moderate (51-100): Sensitive people should reduce outdoor exertion. Unhealthy (101-150): Sensitive groups should reduce outdoor activities. Unhealthy (151-200): Everyone should reduce outdoor activities. Very Unhealthy (201-300): Avoid outdoors. Hazardous (301+): Stay indoors.',
        'carbon_tips': '5 tips to reduce carbon footprint: 1) Use public transport or carpool 2) Reduce energy consumption at home 3) Choose renewable energy sources 4) Eat more plant-based meals 5) Reduce, reuse, and recycle waste',
        'pm25_explanation': 'PM2.5 are fine particles ≤2.5 micrometers. They penetrate deep into lungs and cause heart disease, lung cancer, and respiratory issues.',
        'pm10_explanation': 'PM10 are particles ≤10 micrometers including dust, pollen, and mold. Less harmful than PM2.5 but can still cause respiratory issues.',
        'best_cities': 'Cities with generally good air quality in India include Shimla, Mysuru, Thiruvananthapuram, and Coimbatore. Hill stations and coastal cities tend to have better AQI.',
        'pollution_sources': 'Major sources of air pollution include: 1) Vehicle exhaust emissions 2) Industrial factories and power plants 3) Construction dust and debris 4) Crop burning and wildfires 5) Household cooking with solid fuels. Reducing these sources is key to improving AQI.',
        'indoor_air': 'To improve indoor air quality: 1) Use air purifiers with HEPA filters 2) Keep indoor plants like snake plant, peace lily, and spider plant 3) Ensure proper ventilation 4) Avoid smoking indoors 5) Use exhaust fans while cooking. Indoor air can be 2-5x more polluted than outdoor air.',
        'default_response': 'I can only answer questions related to AQI. Try asking about AQI levels, health advice, carbon footprint, PM2.5, PM10, pollution sources, indoor air quality, or best cities for clean air.'
    },
    'ta': {
        'aqi_explanation': 'காற்று தர குறியீடு (AQI) 0-500 வரை உள்ளது. 0-50 நல்லது, 51-100 மிதமானது, 101-150 உணர்திறன் குழுக்களுக்கு ஆரோக்கமற்றது, 151-200 ஆரோக்கமற்றது, 201-300 மிகவும் ஆரோக்கமற்றது, 301+ ஆபத்தானது.',
        'health_advice': 'AQI அடிப்படையில் ஆரோக்க ஆலோசனை: நல்லது (0-50): வெளிப்புற செயல்பாடுகளை அனுபவிக்கவும். மிதமானது (51-100): உணர்திறன் கொண்டவர்கள் வெளிப்புற உடற்பயிற்சியைக் குறைக்க வேண்டும். ஆரோக்கமற்றது (151-200): அனைவரும் வெளியில் செல்வதைத் தவிர்க்கவும்.',
        'carbon_tips': 'கார்பன் தடம் குறைக்க 5 வழிகள்: 1) பொது போக்குவரத்து பயன்படுத்துங்கள் 2) வீட்டில் மின்சாரம் மிச்சப்படுத்துங்கள் 3) சூரிய சக்தி பயன்படுத்துங்கள் 4) தாவர உணவுகளை அதிகமாக சாப்பிடுங்கள் 5) குப்பையை குறைத்து மறுசுழற்சி செய்யுங்கள்',
        'pm25_explanation': 'PM2.5 என்பவை 2.5 மைக்ரோமீட்டரை விட சிறிய துகள்கள். இவை நுரையீரலுக்குள் ஊடுருவி இதய நோய், நுரையீரல் புற்றுநோய் மற்றும் சுவாச பிரச்சினைகளை ஏற்படுத்தலாம்.',
        'pm10_explanation': 'PM10 என்பவை 10 மைக்ரோமீட்டரை விட சிறிய தூசு, மகரந்த துகள்கள். இவை சுவாசப் பிரச்சினைகளை ஏற்படுத்தலாம்.',
        'best_cities': 'இந்தியாவில் நல்ல காற்று தரம் உள்ள நகரங்கள்: சிம்லா, மைசூரு, திருவனந்தபுரம், கோயம்புத்தூர். மலைப் பகுதிகள் மற்றும் கடலோர நகரங்களில் சுத்தமான காற்று உள்ளது.',
        'default_response': 'நான் AQI தொடர்பான கேள்விகளுக்கு மட்டுமே பதிலளிக்க முடியும். AQI நிலைகள், ஆரோக்க ஆலோசனை, கார்பன் தடம் குறைப்பு அல்லது PM2.5 பற்றி கேளுங்கள்.'
    },
    'hi': {
        'aqi_explanation': 'वायु गुणवत्ता सूचकांक (AQI) 0-500 के बीच होता है। 0-50 अच्छा, 51-100 मध्यम, 101-150 संवेदनशील समूहों के लिए अस्वस्थ, 151-200 अस्वस्थ, 201-300 बहुत अस्वस्थ, 301+ खतरनाक।',
        'health_advice': 'AQI के अनुसार स्वास्थ्य सलाह: अच्छा (0-50): बाहरी गतिविधियाँ करें। मध्यम (51-100): संवेदनशील लोग बाहरी व्यायाम कम करें। अस्वस्थ (151-200): सभी बाहरी गतिविधियाँ कम करें। खतरनाक (301+): घर के अंदर रहें।',
        'carbon_tips': 'कार्बन फुटप्रिंट कम करने के 5 तरीके: 1) सार्वजनिक परिवहन उपयोग करें 2) बिजली बचाएं 3) नवीकरणीय ऊर्जा चुनें 4) पौधे-आधारित भोजन खाएं 5) कचरा कम करें और रीसाइकल करें',
        'pm25_explanation': 'PM2.5 2.5 माइक्रोमीटर से छोटे कण हैं जो फेफड़ों में गहराई तक जाते हैं और हृदय रोग, फेफड़ों का कैंसर व श्वास समस्याएं पैदा कर सकते हैं।',
        'pm10_explanation': 'PM10 धूल, पराग और फफूंद के 10 माइक्रोमीटर से छोटे कण हैं। ये भी श्वास समस्याएं बढ़ा सकते हैं।',
        'best_cities': 'भारत में स्वच्छ हवा वाले शहर: शिमला, मैसूरु, तिरुवनंतपुरम, कोयंबटूर। पहाड़ी और तटीय शहरों में आमतौर पर बेहतर AQI होता है।',
        'default_response': 'मैं केवल AQI से संबंधित प्रश्नों का उत्तर दे सकता हूं। AQI स्तर, स्वास्थ्य सलाह, कार्बन फुटप्रिंट कमी, या PM2.5 के बारे में पूछें।'
    },
    'bn': {
        'aqi_explanation': 'বায়ু মান সূচক (AQI) ০-৫০০ পর্যন্ত। ০-৫০ ভালো, ৫১-১০০ মাঝারি, ১০১-১৫০ সংবেদনশীলদের জন্য ক্ষতিকর, ১৫১-২০০ অস্বাস্থ্যকর, ২০১-৩০০ অত্যন্ত অস্বাস্থ্যকর, ৩০১+ বিপজ্জনক।',
        'health_advice': 'AQI অনুযায়ী স্বাস্থ্য পরামর্শ: ভালো (০-৫০): বাইরে থাকুন। মাঝারি (৫১-১০০): সংবেদনশীল মানুষ বাইরের পরিশ্রম কমান। অস্বাস্থ্যকর (১৫১-২০০): সবাই বাইরে কম থাকুন। বিপজ্জনক (৩০১+): ঘরে থাকুন।',
        'carbon_tips': 'কার্বন ফুটপ্রিন্ট কমানোর ৫ উপায়: ১) গণপরিবহন ব্যবহার করুন ২) বাড়িতে বিদ্যুৎ সাশ্রয় করুন ৩) নবায়নযোগ্য শক্তি বেছে নিন ৪) বেশি উদ্ভিজ্জ খাবার খান ৫) বর্জ্য কমিয়ে পুনর্ব্যবহার করুন',
        'pm25_explanation': 'PM2.5 হলো ২.৫ মাইক্রোমিটারের চেয়ে ছোট কণা যা ফুসফুসে গভীরে প্রবেশ করে হৃদরোগ, ফুসফুসের ক্যান্সার ও শ্বাস সমস্যা সৃষ্টি করতে পারে।',
        'pm10_explanation': 'PM10 হলো ধুলো, পরাগ ও ছাঁচের ১০ মাইক্রোমিটারের কণা। এগুলো শ্বাসকষ্ট বাড়াতে পারে।',
        'best_cities': 'ভারতে ভালো বায়ু মানের শহর: শিমলা, মহীশূর, তিরুবনন্তপুরম, কোয়েম্বাটুর। পার্বত্য ও উপকূলীয় শহরে সাধারণত পরিষ্কার বাতাস পাওয়া যায়।',
        'default_response': 'আমি শুধুমাত্র AQI সম্পর্কিত প্রশ্নের উত্তর দিতে পারি। AQI স্তর, স্বাস্থ্য পরামর্শ, কার্বন ফুটপ্রিন্ট হ্রাস, বা PM2.5 সম্পর্কে জিজ্ঞেস করুন।'
    },
    'te': {
        'aqi_explanation': 'వాయు నాణ్యత సూచిక (AQI) 0-500 వరకు ఉంటుంది. 0-50 మంచిది, 51-100 మధ్యస్తం, 101-150 సున్నితమైన వారికి హానికరం, 151-200 అనారోగ్యకరం, 201-300 చాలా అనారోగ్యకరం, 301+ ప్రమాదకరం.',
        'health_advice': 'AQI ఆధారంగా ఆరోగ్య సూచనలు: మంచిది (0-50): బయట గడపండి. మధ్యస్తం (51-100): సున్నితమైన వారు బయట వ్యాయామం తగ్గించండి. అనారోగ్యకరం (151-200): అందరూ బయటి కార్యకలాపాలు తగ్గించండి. ప్రమాదకరం (301+): ఇంట్లో ఉండండి.',
        'carbon_tips': 'కార్బన్ పాదముద్ర తగ్గించడానికి 5 మార్గాలు: 1) బహిరంగ రవాణా వాడండి 2) ఇంట్లో విద్యుత్ ఆదా చేయండి 3) పునరుత్పాదక శక్తి ఎంచుకోండి 4) మొక్కల ఆహారం తినండి 5) వ్యర్థాలు తగ్గించి రీసైకిల్ చేయండి',
        'pm25_explanation': 'PM2.5 అంటే 2.5 మైక్రోమీటర్ కంటే చిన్న కణాలు. ఇవి ఊపిరితిత్తుల లోపలికి వెళ్ళి గుండె జబ్బులు, ఊపిరితిత్తుల క్యాన్సర్ కలిగిస్తాయి.',
        'pm10_explanation': 'PM10 అంటే దుమ్ము, పుప్పొడి వంటి 10 మైక్రోమీటర్ కణాలు. ఇవి శ్వాసకోశ సమస్యలు కలిగిస్తాయి.',
        'best_cities': 'భారతదేశంలో మంచి గాలి నాణ్యత ఉన్న నగరాలు: శిమ్లా, మైసూరు, తిరువనంతపురం, కోయంబత్తూరు. కొండ ప్రాంతాలు మరియు తీర నగరాల్లో సాధారణంగా మంచి AQI ఉంటుంది.',
        'default_response': 'నేను AQI సంబంధిత ప్రశ్నలకు మాత్రమే సమాధానం ఇవ్వగలను. AQI స్థాయిలు, ఆరోగ్య సలహా, కార్బన్ ఫుట్‌ప్రింట్ తగ్గింపు, లేదా PM2.5 గురించి అడగండి.'
    }
}

def get_chatbot_response(message: str, language: str = 'en') -> str:
    """Rule-based chatbot response generation"""
    
    message_lower = message.lower()
    translations = TRANSLATIONS.get(language, TRANSLATIONS['en'])
    
    # Check for AQI related keywords
    if re.search(r'\baqi\b|air quality', message_lower):
        return translations['aqi_explanation']
    
    # Check for health related keywords
    elif re.search(r'\bhealth\b|\bsafe\b', message_lower):
        return translations['health_advice']
    
    # Check for carbon/footprint related keywords
    elif re.search(r'\breduce\b|\bcarbon\b|\bfootprint\b', message_lower):
        return translations['carbon_tips']
    
    # Check for PM2.5 specific question
    elif re.search(r'\bpm2\.?5\b', message_lower):
        return translations['pm25_explanation']
    
    # Check for PM10 specific question
    elif re.search(r'\bpm10\b', message_lower):
        return translations['pm10_explanation']
    
    # Check for best cities question
    elif re.search(r'\bbest cit|\bclean.*(city|cities)|\bgood.*(air|aqi)', message_lower):
        return translations['best_cities']
    
    # Check for pollution sources
    elif re.search(r'\bpollut|\bsource|\bcause|\bemission', message_lower):
        return translations.get('pollution_sources', TRANSLATIONS['en']['pollution_sources'])
    
    # Check for indoor air quality
    elif re.search(r'\bindoor|\bpurif|\bplant|\bventilat', message_lower):
        return translations.get('indoor_air', TRANSLATIONS['en']['indoor_air'])
    
    # Default response for all other questions
    else:
        return translations['default_response']

async def get_groq_response(message: str) -> str | None:
    if not GROQ_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": message}
                    ],
                    "max_tokens": 400,
                    "temperature": 0.7
                }
            )
            if r.status_code == 200:
                return r.json()["choices"][0]["message"]["content"]
        return None
    except Exception:
        return None

@router.post("/message", response_model=ChatbotResponse)
async def chatbot_message(
    chat_request: ChatbotRequest,
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Process chatbot message and return response"""
    
    # Get user from token — auto-create if not registered yet
    firebase_uid = token_data.get('uid')
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        # Auto-create user from Firebase token data so chatbot always works
        user = User(
            firebase_uid=firebase_uid,
            email=token_data.get('email', f'{firebase_uid}@unknown.com'),
            name=token_data.get('name', token_data.get('email', 'User')),
            password_hash='firebase_auth',
            preferred_language='en',
            role='user'
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Try Groq first; offline rule-based engine is the fallback
    bot_response = await get_groq_response(chat_request.message)
    if bot_response is None:
        bot_response = get_chatbot_response(chat_request.message, chat_request.language)
    
    # Save to chatbot_logs table
    chat_log = ChatbotLog(
        user_id=user.user_id,
        user_message=chat_request.message,
        bot_response=bot_response
    )
    
    db.add(chat_log)
    db.commit()
    
    return ChatbotResponse(
        response=bot_response,
        language=chat_request.language
    )
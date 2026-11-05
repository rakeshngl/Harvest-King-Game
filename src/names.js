import { TILES, CROPS, GROUPS, SEASONS, WEATHER, KISAN_CARDS, MANDI_CARDS } from './data.js'
import { t, currentLang, tLang } from './i18n.js'

const STAGE_KEY = {
  idle: 'stIdle',
  prepared: 'stPrepared',
  seeded: 'stSeeded',
  ripe: 'stRipe'
}

const PICK_REASON = {
  'Village labour day — work one field.': 'pickLabour',
  'Mela demonstration plot — advance one field.': 'pickMela',
  'hail damage': 'hailDamage'
}

const PACK = {
  hi: {
    tile: {
      0: { name: 'ग्राम सभा', short: 'जाओ', sub: 'फसल बकाया लें' },
      1: { name: 'बाड़मेर बाजरा', short: 'बाड़मेर', region: 'राजस्थान' },
      2: { name: 'किसान पत्ता', short: 'पत्ता', sub: 'खेतों की किस्मत' },
      3: { name: 'मालवा ज्वार', short: 'मालवा', region: 'मध्य प्रदेश' },
      4: { name: 'भू-राजस्व', short: 'कर', sub: '८% नकद या ₹८००, जो अधिक हो' },
      5: { name: 'ट्रैक्टर स्टैंड', short: 'ट्रैक्टर', sub: 'कृषि मशीनरी' },
      6: { name: 'जूनागढ़ मूंगफली', short: 'जूनागढ़', region: 'गुजरात' },
      7: { name: 'बाज़ार भाव', short: 'बाज़ार', sub: 'बाज़ार उतार-चढ़ाव' },
      8: { name: 'विदर्भ कपास', short: 'विदर्भ', region: 'महाराष्ट्र' },
      9: { name: 'वारंगल कपास', short: 'वारंगल', region: 'तेलंगाना' },
      10: { name: 'कृषि मेला', short: 'मेला', sub: 'मेला बोनस व परीक्षण' },
      11: { name: 'बागपत गन्ना', short: 'बागपत', region: 'उत्तर प्रदेश' },
      12: { name: 'सिंचाई नहर', short: 'नहर', sub: 'जल अधिकार' },
      13: { name: 'मिथिला धान', short: 'मिथिला', region: 'बिहार' },
      14: { name: 'हुगली जूट', short: 'हुगली', region: 'पश्चिम बंगाल' },
      15: { name: 'शीत गृह', short: 'शीत', sub: 'कटाई के बाद श्रृंखला' },
      16: { name: 'लुधियाना गेहूँ', short: 'लुधियाना', region: 'पंजाब' },
      17: { name: 'किसान पत्ता', short: 'पत्ता', sub: 'खेतों की किस्मत' },
      18: { name: 'सिरसा सरसों', short: 'सिरसा', region: 'हरियाणा' },
      19: { name: 'शिमला बाग', short: 'शिमला', region: 'हिमाचल' },
      20: { name: 'अन्न गोदाम', short: 'गोदाम', sub: 'पकी फसल समर्थन मूल्य पर बेचें' },
      21: { name: 'इडुक्की मसाले', short: 'इडुक्की', region: 'केरल' },
      22: { name: 'बाज़ार भाव', short: 'बाज़ार', sub: 'बाज़ार उतार-चढ़ाव' },
      23: { name: 'तंजावुर धान', short: 'तंजावुर', region: 'तमिल नाडु' },
      24: { name: 'कूर्ग कॉफी', short: 'कूर्ग', region: 'कर्नाटक' },
      25: { name: 'बीज बैंक', short: 'बीज', sub: 'प्रमाणित बीज श्रृंखला' },
      26: { name: 'डिब्रूगढ़ चाय', short: 'डिब्रूगढ़', region: 'असम' },
      27: { name: 'बरगढ़ धान', short: 'बरगढ़', region: 'ओडिशा' },
      28: { name: 'नलकूप जाल', short: 'कुआँ', sub: 'भूजल अधिकार' },
      29: { name: 'बस्तर चावल', short: 'बस्तर', region: 'छत्तीसगढ़' },
      30: { name: 'ग्रामीण बैंक', short: 'बैंक', sub: 'फसल ऋण व ब्याज' },
      31: { name: 'कृष्णा आम', short: 'कृष्णा', region: 'आंध्र प्रदेश' },
      32: { name: 'नाशिक अंगूर', short: 'नाशिक', region: 'महाराष्ट्र' },
      33: { name: 'किसान पत्ता', short: 'पत्ता', sub: 'खेतों की किस्मत' },
      34: { name: 'पंपोर केसर', short: 'पंपोर', region: 'कश्मीर' },
      35: { name: 'मंडी यार्ड', short: 'यार्ड', sub: 'थोक बाज़ार' },
      36: { name: 'बाज़ार भाव', short: 'बाज़ार', sub: 'बाज़ार उतार-चढ़ाव' },
      37: { name: 'उंझा जीरा', short: 'उंझा', region: 'गुजरात' },
      38: { name: 'मंडी कर', short: 'शुल्क', sub: '१०% नकद या ₹१२००, जो अधिक हो' },
      39: { name: 'सिक्किम जैविक', short: 'सिक्किम', region: 'सिक्किम' }
    },
    crop: {
      bajra: 'बाजरा',
      jowar: 'ज्वार',
      groundnut: 'मूंगफली',
      cotton: 'कपास',
      sugarcane: 'गन्ना',
      rice: 'धान',
      jute: 'जूट',
      wheat: 'गेहूँ',
      mustard: 'सरसों',
      apple: 'सेब',
      spices: 'मसाले',
      coffee: 'कॉफी',
      tea: 'चाय',
      mango: 'आम',
      grape: 'अंगूर',
      cumin: 'जीरा',
      saffron: 'केसर',
      moong: 'मूंग'
    },
    group: {
      arid: 'शुष्क पट्टी',
      oil: 'तिलहन पट्टी',
      cotton: 'कपास पट्टी',
      gangetic: 'गंगा मैदान',
      wheat: 'गेहूँ पट्टी',
      spice: 'मसाला तट',
      hill: 'पहाड़ी बाग',
      orchard: 'बाग पट्टी'
    },
    season: {
      kharif: { name: 'मानसून', hint: 'वर्षाकाल बोआई' },
      rabi: { name: 'सर्दी', hint: 'शीतकालीन बोआई' },
      zaid: { name: 'गर्मी', hint: 'गर्मी की फसल' }
    },
    weather: {
      normal: { name: 'साफ आसमान', text: 'औसत उगान मौसम।' },
      monsoon: { name: 'अच्छा मानसून', text: 'खेत भरपूर पानी पीते हैं। जलप्रिय फसलें फलती हैं।' },
      drought: { name: 'सूखा', text: 'सिंचाई या सूखा-सह फसल न हो तो उपज गिरती है।' },
      flood: { name: 'बाढ़', text: 'निचले धान मिश्रित भाग्य; बाग झेलते हैं।' },
      hail: { name: 'ओला पट्टी', text: 'पहाड़ी और बाग की फसलें चोट खाती हैं।' }
    },
    kisan: {
      pmkisan: { title: 'किसान सहायता राशि', text: 'प्रत्यक्ष लाभ खाते में आया।' },
      monsoon: { title: 'समय पर मानसून', text: 'आपके सभी बोए खेतों की उर्वरता +१।' },
      drought: { title: 'सूखे की चेतावनी', text: 'बिना सिंचाई बोए खेतों की उर्वरता घटती है।' },
      pest: { title: 'फॉल आर्मीवर्म', text: 'प्रत्येक बोए खेत पर ₹७०० दें वरना फसल जाए।' },
      diesel: { title: 'डीजल बढ़ोतरी', text: 'प्रत्येक अपने या पट्टे खेत पर ₹४०० दें।' },
      subsidy: { title: 'बीज सब्सिडी', text: 'खजाने से ₹१५०० लें।' },
      soil: { title: 'मृदा स्वास्थ्य कार्ड', text: 'अगली भूमि तैयारी मुफ्त।' },
      hail: { title: 'ओलावृष्टि', text: 'एक पकी या बोई फसल क्षतिग्रस्त। अपेक्षित उपज मूल्य का ५०% जाए।' },
      export: { title: 'निर्यात कोटा खुला', text: 'बाग और मसाला भाव इस मौसम २५% बढ़े।' },
      ban: { title: 'निर्यात प्रतिबंध', text: 'प्याज/मसाला घबराहट। मसाला भाव २०% गिरे।' },
      canal: { title: 'नहर चक्र', text: 'यदि सिंचाई नहर आपकी है, ₹१२०० लें।' },
      coop: { title: 'सहकारी लाभांश', text: 'प्रत्येक प्रतिद्वंद्वी से ₹२०० लें।' },
      insurance: { title: 'फसल बीमा दावा', text: 'कोई खेत बीमित हो तो ₹२५०० लें।' },
      kvk: { title: 'कृषि विद्यालय प्रशिक्षण', text: 'इस मौसम आपके सभी खेतों को सिंचाई ज्ञान।' },
      coldfail: { title: 'शीत गृह विफलता', text: 'शीत गृह न हो तो ₹९०० दें।' },
      organic: { title: 'जैविक प्रमाण', text: 'सिक्किम जैविक या मसाला खेत अभी +₹८०० कमाएँ।' },
      msp: { title: 'समर्थन मूल्य बढ़ोतरी', text: 'गेहूँ, धान और कपास समर्थन मूल्य १५% बढ़ा।' },
      labour: { title: 'मजदूर कमी', text: '₹६०० दें या अगली कटाई बोनस छोड़ें।' }
    },
    mandi: {
      boom: { title: 'त्योहार माँग', text: 'सभी बाज़ार भाव १२% बढ़े।' },
      crash: { title: 'बाज़ार भरमार', text: 'सभी बाज़ार भाव १२% गिरे।' },
      fci: { title: 'सरकारी खरीद', text: 'गेहूँ या धान खेत हों तो ₹१८०० लें।' },
      trader: { title: 'बिचौलिया शुल्क', text: '₹१००० मंडी कमीशन दें।' },
      warehouse: { title: 'गोदाम रसीद', text: '₹२२०० लें।' },
      transport: { title: 'राजमार्ग हड़ताल', text: 'प्रत्येक नियंत्रित खेत पर ₹१५० दें।' },
      futures: { title: 'वस्तु उछाल', text: 'कपास और जीरा ३०% उछलें।' },
      rain: { title: 'बेमौसम बारिश', text: 'पकी फसल सड़ सकती है। प्रत्येक पके खेत पर ४०% कटाई जाए।' },
      eNAM: { title: 'ऑनलाइन मंडी सूची', text: '₹५०० लें और इस मौसम बिक्री भाव +५%।' },
      loanwaiver: { title: 'ब्याज राहत', text: 'ग्रामीण बैंक ब्याज एक बार माफ। कर्ज़ ₹१५०० घटे।' },
      fertilizer: { title: 'यूरिया कमी', text: 'तैयारी लागत बढ़ी। अभी ₹५०० दें।' },
      bonus: { title: 'गन्ना फ्रुक्टोज आदेश', text: 'गन्ना धारक ₹१६०० लें।' }
    }
  },
  ta: {
    tile: {
      0: { name: 'கிராம மன்றம்', short: 'போ', sub: 'அறுவடை பாக்கி பெறு' },
      1: { name: 'பார்மர் கம்பு', short: 'பார்மர்', region: 'ராஜஸ்தான்' },
      2: { name: 'விவசாயி சீட்டு', short: 'சீட்டு', sub: 'வயல்களின் விதி' },
      3: { name: 'மால்வா சோளம்', short: 'மால்வா', region: 'மத்திய பிரதேசம்' },
      4: { name: 'நில வரி', short: 'வரி', sub: '8% பணம் அல்லது ₹800, எது அதிகமோ' },
      5: { name: 'டிராக்டர் நிலை', short: 'டிராக்டர்', sub: 'வேளாண் இயந்திரம்' },
      6: { name: 'ஜூனாகத் நிலக்கடலை', short: 'ஜூனாகத்', region: 'குஜராத்' },
      7: { name: 'சந்தை விலை', short: 'சந்தை', sub: 'சந்தை ஏற்ற இறக்கங்கள்' },
      8: { name: 'விதர்பா பருத்தி', short: 'விதர்பா', region: 'மகாராஷ்டிரா' },
      9: { name: 'வாரங்கல் பருத்தி', short: 'வாரங்கல்', region: 'தெலுங்கானா' },
      10: { name: 'பண்ணை மேளா', short: 'மேளா', sub: 'மேளா போனஸ் மற்றும் சோதனைகள்' },
      11: { name: 'பாக்பத் கரும்பு', short: 'பாக்பத்', region: 'உத்தர பிரதேசம்' },
      12: { name: 'பாசன கால்வாய்', short: 'கால்வாய்', sub: 'நீர் உரிமை' },
      13: { name: 'மிதிலா நெல்', short: 'மிதிலா', region: 'பிகார்' },
      14: { name: 'ஹூக்ளி சணல்', short: 'ஹூக்ளி', region: 'மேற்கு வங்கம்' },
      15: { name: 'குளிர்ப்பதனம்', short: 'குளிர்', sub: 'அறுவடைக்குப் பின் சங்கிலி' },
      16: { name: 'லுதியானா கோதுமை', short: 'லுதியானா', region: 'பஞ்சாப்' },
      17: { name: 'விவசாயி சீட்டு', short: 'சீட்டு', sub: 'வயல்களின் விதி' },
      18: { name: 'சிர்சா கடுகு', short: 'சிர்சா', region: 'அரியானா' },
      19: { name: 'சிம்லா தோட்டங்கள்', short: 'சிம்லா', region: 'இமாச்சல்' },
      20: { name: 'உணவு கிடங்கு', short: 'கிடங்கு', sub: 'பழுத்த அறுவடையை ஆதரவு விலையில் விற்று' },
      21: { name: 'இடுக்கி மசாலா', short: 'இடுக்கி', region: 'கேரளா' },
      22: { name: 'சந்தை விலை', short: 'சந்தை', sub: 'சந்தை ஏற்ற இறக்கங்கள்' },
      23: { name: 'தஞ்சாவூர் நெல்', short: 'தஞ்சாவூர்', region: 'தமிழ்நாடு' },
      24: { name: 'கூர்க் காபி', short: 'கூர்க்', region: 'கர்நாடகா' },
      25: { name: 'விதை வங்கி', short: 'விதை', sub: 'சான்றளிக்கப்பட்ட விதை சங்கிலி' },
      26: { name: 'திப்ருகர் தேநீர்', short: 'திப்ருகர்', region: 'அசாம்' },
      27: { name: 'பர்கர் நெல்', short: 'பர்கர்', region: 'ஒடிசா' },
      28: { name: 'ஆழ்குழாய் வலை', short: 'கிணறு', sub: 'நிலத்தடி நீர் உரிமை' },
      29: { name: 'பஸ்தர் அரிசி', short: 'பஸ்தர்', region: 'சத்தீஸ்கர்' },
      30: { name: 'கிராமிய வங்கி', short: 'வங்கி', sub: 'பயிர் கடன் மற்றும் வட்டி' },
      31: { name: 'கிருஷ்ணா மாம்பழம்', short: 'கிருஷ்ணா', region: 'ஆந்திர பிரதேசம்' },
      32: { name: 'நாசிக் திராட்சை', short: 'நாசிக்', region: 'மகாராஷ்டிரா' },
      33: { name: 'விவசாயி சீட்டு', short: 'சீட்டு', sub: 'வயல்களின் விதி' },
      34: { name: 'பம்போர் குங்குமப்பூ', short: 'பம்போர்', region: 'காஷ்மீர்' },
      35: { name: 'சந்தை முற்றம்', short: 'முற்றம்', sub: 'மொத்த சந்தை' },
      36: { name: 'சந்தை விலை', short: 'சந்தை', sub: 'சந்தை ஏற்ற இறக்கங்கள்' },
      37: { name: 'உஞ்சா சீரகம்', short: 'உஞ்சா', region: 'குஜராத்' },
      38: { name: 'சந்தை வரி', short: 'சுங்கம்', sub: '10% பணம் அல்லது ₹1200, எது அதிகமோ' },
      39: { name: 'சிக்கிம் இயற்கை', short: 'சிக்கிம்', region: 'சிக்கிம்' }
    },
    crop: {
      bajra: 'கம்பு',
      jowar: 'சோளம்',
      groundnut: 'நிலக்கடலை',
      cotton: 'பருத்தி',
      sugarcane: 'கரும்பு',
      rice: 'நெல்',
      jute: 'சணல்',
      wheat: 'கோதுமை',
      mustard: 'கடுகு',
      apple: 'ஆப்பிள்',
      spices: 'மசாலா',
      coffee: 'காபி',
      tea: 'தேநீர்',
      mango: 'மாம்பழம்',
      grape: 'திராட்சை',
      cumin: 'சீரகம்',
      saffron: 'குங்குமப்பூ',
      moong: 'பச்சைப்பயறு'
    },
    group: {
      arid: 'வறண்ட பட்டி',
      oil: 'எண்ணெய்வித்து பட்டி',
      cotton: 'பருத்தி பட்டி',
      gangetic: 'கங்கை சமவெளி',
      wheat: 'கோதுமை பட்டி',
      spice: 'மசாலா கடற்கரை',
      hill: 'மலைத் தோட்டங்கள்',
      orchard: 'பழத்தோட்ட பட்டி'
    },
    season: {
      kharif: { name: 'பருவமழை', hint: 'மழைக்கால விதைப்பு' },
      rabi: { name: 'குளிர்காலம்', hint: 'குளிர்கால விதைப்பு' },
      zaid: { name: 'கோடை', hint: 'கோடை இடைப்பயிர்' }
    },
    weather: {
      normal: { name: 'தெளிவான வானம்', text: 'சராசரி வளர்ச்சி வானிலை.' },
      monsoon: { name: 'நல்ல பருவமழை', text: 'வயல்கள் நன்றாக குடிக்கும். நீர் விரும்பும் பயிர்கள் செழிக்கும்.' },
      drought: { name: 'வறட்சி', text: 'பாசனம் அல்லது வறட்சி தாங்கும் பயிர் இல்லையெனில் விளைச்சல் குறையும்.' },
      flood: { name: 'வெள்ளம்', text: 'தாழ் நெல் கலவையான அதிர்ஷ்டம்; தோட்டங்கள் பாதிக்கப்படும்.' },
      hail: { name: 'ஆலங்கட்டி பட்டி', text: 'மலை மற்றும் தோட்டப் பயிர்கள் அடிக்கப்படும்.' }
    },
    kisan: {
      pmkisan: { title: 'பண்ணை உதவித் தொகை', text: 'நேரடி பலன் கணக்கில் வரவு.' },
      monsoon: { title: 'சரியான நேர பருவமழை', text: 'உங்கள் விதைத்த வயல்கள் அனைத்தும் +1 வளம்.' },
      drought: { title: 'வறட்சி எச்சரிக்கை', text: 'பாசனம் இல்லாத விதைத்த வயல்கள் வளம் இழக்கும்.' },
      pest: { title: 'இலையுண்ணி புழு', text: 'விதைத்த ஒவ்வொரு வயலுக்கும் ₹700 செலுத்துங்கள் இல்லையெனில் பயிர் போகும்.' },
      diesel: { title: 'டீசல் உயர்வு', text: 'சொந்த அல்லது குத்தகை ஒவ்வொரு வயலுக்கும் ₹400 செலுத்துங்கள்.' },
      subsidy: { title: 'விதை மானியம்', text: 'கருவூலத்திலிருந்து ₹1500 பெறுங்கள்.' },
      soil: { title: 'மண் நல அட்டை', text: 'அடுத்த நிலத் தயாரிப்பு இலவசம்.' },
      hail: { title: 'ஆலங்கட்டி மழை', text: 'ஒரு பழுத்த அல்லது விதைத்த பயிர் சேதமடையும். எதிர்பார்க்கும் விளைச்சல் மதிப்பில் 50% இழப்பு.' },
      export: { title: 'ஏற்றுமதி ஒதுக்கீடு திறப்பு', text: 'தோட்ட மற்றும் மசாலா விலை இந்த பருவத்தில் 25% உயரும்.' },
      ban: { title: 'ஏற்றுமதி தடை', text: 'வெங்காயம்/மசாலா பீதி. மசாலா விலை 20% வீழும்.' },
      canal: { title: 'கால்வாய் சுழற்சி', text: 'பாசன கால்வாய் உங்களுடையது என்றால் ₹1200 பெறுங்கள்.' },
      coop: { title: 'கூட்டுறவு ஈவுத்தொகை', text: 'ஒவ்வொரு போட்டியாளரிடமிருந்தும் ₹200 பெறுங்கள்.' },
      insurance: { title: 'பயிர் காப்பீட்டு உரிமைகோரல்', text: 'ஏதேனும் வயல் காப்பீடு இருந்தால் ₹2500 பெறுங்கள்.' },
      kvk: { title: 'பண்ணை பள்ளி பயிற்சி', text: 'இந்த பருவத்தில் உங்கள் அனைத்து வயல்களுக்கும் பாசன அறிவு.' },
      coldfail: { title: 'குளிர்ப்பதன தோல்வி', text: 'குளிர்ப்பதனம் இல்லையெனில் ₹900 செலுத்துங்கள்.' },
      organic: { title: 'இயற்கை சான்றிதழ்', text: 'சிக்கிம் இயற்கை அல்லது மசாலா வயல்கள் இப்போது +₹800 ஈட்டும்.' },
      msp: { title: 'ஆதரவு விலை உயர்வு', text: 'கோதுமை, நெல் மற்றும் பருத்தி ஆதரவு விலை 15% உயரும்.' },
      labour: { title: 'தொழிலாளர் பற்றாக்குறை', text: '₹600 செலுத்துங்கள் அல்லது அடுத்த அறுவடை போனஸைத் தவிர்க்கவும்.' }
    },
    mandi: {
      boom: { title: 'திருவிழா தேவை', text: 'அனைத்து சந்தை விலைகளும் 12% உயரும்.' },
      crash: { title: 'சந்தை மிகை', text: 'அனைத்து சந்தை விலைகளும் 12% வீழும்.' },
      fci: { title: 'அரசு கொள்முதல்', text: 'கோதுமை அல்லது நெல் வயல் இருந்தால் ₹1800 பெறுங்கள்.' },
      trader: { title: 'இடைத்தரகர் கட்டணம்', text: '₹1000 சந்தை கமிஷன் செலுத்துங்கள்.' },
      warehouse: { title: 'கிடங்கு ரசீது', text: '₹2200 பெறுங்கள்.' },
      transport: { title: 'நெடுஞ்சாலை வேலைநிறுத்தம்', text: 'நீங்கள் கட்டுப்படுத்தும் ஒவ்வொரு வயலுக்கும் ₹150 செலுத்துங்கள்.' },
      futures: { title: 'பொருள் உயர்வு', text: 'பருத்தி மற்றும் சீரகம் 30% உயரும்.' },
      rain: { title: 'பருவமில்லா மழை', text: 'பழுத்த பயிர்கள் அழுகலாம். ஒவ்வொரு பழுத்த வயலுக்கும் 40% அறுவடை இழக்க வாய்ப்பு.' },
      eNAM: { title: 'ஆன்லைன் சந்தை பட்டியல்', text: '₹500 பெற்று இந்த பருவத்தில் விற்பனை விலை +5%.' },
      loanwaiver: { title: 'வட்டி நிவாரணம்', text: 'கிராமிய வங்கி வட்டி ஒருமுறை தள்ளுபடி. கடன் ₹1500 குறையும்.' },
      fertilizer: { title: 'யூரியா பற்றாக்குறை', text: 'தயாரிப்பு செலவு உயரும். இப்போது ₹500 செலுத்துங்கள்.' },
      bonus: { title: 'கரும்பு பிரக்டோஸ் ஆணை', text: 'கரும்பு வைத்திருப்பவர் ₹1600 பெறுங்கள்.' }
    }
  }
}

function packOf(lang) {
  return PACK[lang] || null
}

function tileObj(tile) {
  if (tile == null) return null
  if (typeof tile === 'number') return TILES[tile] || null
  if (typeof tile === 'string') return TILES.find((x) => x.name === tile) || null
  return tile
}

function locTile(tile, lang) {
  const src = tileObj(tile)
  if (!src) return null
  const loc = packOf(lang)?.tile?.[src.id]
  return loc ? { ...src, ...loc } : src
}

export function tileName(tile, field = 'name') {
  const src = locTile(tile, currentLang())
  if (!src) return ''
  if (field === 'name') return src.name || ''
  return src[field] || ''
}

export function tileShort(tile) {
  const src = locTile(tile, currentLang())
  if (!src) return ''
  return src.short || src.name || ''
}

export function tileRegion(tile) {
  return tileName(tile, 'region')
}

export function tileSub(tile) {
  return tileName(tile, 'sub')
}

export function cropName(id) {
  if (!id) return ''
  const lang = currentLang()
  const loc = packOf(lang)?.crop?.[id]
  if (loc) return loc
  return CROPS[id]?.name || id
}

export function groupName(id) {
  if (!id) return ''
  const lang = currentLang()
  const loc = packOf(lang)?.group?.[id]
  if (loc) return loc
  return GROUPS[id]?.name || id
}

export function seasonName(season) {
  const id = typeof season === 'string' ? season : season?.id
  if (!id) return ''
  const lang = currentLang()
  const loc = packOf(lang)?.season?.[id]
  if (loc) return loc.name
  const src = typeof season === 'object' && season?.name ? season : SEASONS.find((s) => s.id === id)
  return src?.name || id
}

export function seasonHint(season) {
  const id = typeof season === 'string' ? season : season?.id
  if (!id) return ''
  const lang = currentLang()
  const loc = packOf(lang)?.season?.[id]
  if (loc) return loc.hint
  const src = typeof season === 'object' && season?.hint ? season : SEASONS.find((s) => s.id === id)
  return src?.hint || ''
}

export function weatherName(w) {
  const id = typeof w === 'string' ? w : w?.id
  if (!id) return ''
  const lang = currentLang()
  const loc = packOf(lang)?.weather?.[id]
  if (loc) return loc.name
  const src = typeof w === 'object' && w?.name ? w : WEATHER.find((x) => x.id === id)
  return src?.name || id
}

export function weatherText(w) {
  const id = typeof w === 'string' ? w : w?.id
  if (!id) return ''
  const lang = currentLang()
  const loc = packOf(lang)?.weather?.[id]
  if (loc) return loc.text
  const src = typeof w === 'object' && w?.text ? w : WEATHER.find((x) => x.id === id)
  return src?.text || ''
}

function cardLoc(card, lang) {
  if (!card) return null
  const p = packOf(lang)
  if (!p) return null
  return p.kisan?.[card.id] || p.mandi?.[card.id] || null
}

export function cardTitle(card) {
  if (!card) return ''
  return cardLoc(card, currentLang())?.title || card.title || ''
}

export function cardText(card) {
  if (!card) return ''
  return cardLoc(card, currentLang())?.text || card.text || ''
}

export function deckName(deck) {
  if (deck === 'Farmer Card' || deck === 'kisan') return tileName(2)
  if (deck === 'Market Prices' || deck === 'mandi') return tileName(7)
  return localizeNames(deck || '')
}

export function stageName(stage) {
  const key = STAGE_KEY[stage]
  return key ? t(key) : (stage || '')
}

export function soilName(soil) {
  if (!soil) return ''
  const v = t('soil_' + soil)
  return v === 'soil_' + soil ? soil : v
}

export function reasonText(reason) {
  if (!reason) return ''
  const key = PICK_REASON[reason]
  if (key) return t(key)
  const leased = /^crossing leased (.+)$/.exec(reason)
  if (leased) return t('crossingLeased', localizeNames(leased[1]))
  const cross = /^crossing (.+)$/.exec(reason)
  if (cross) return t('crossing', localizeNames(cross[1]))
  return localizeNames(reason)
}

function replacementsFor(lang) {
  if (!packOf(lang)) return []
  const pairs = []
  TILES.forEach((tile) => {
    const loc = packOf(lang).tile[tile.id]
    if (!loc) return
    if (tile.name && loc.name) pairs.push([tile.name, loc.name])
    if (tile.region && loc.region) pairs.push([tile.region, loc.region])
    if (tile.sub && loc.sub) pairs.push([tile.sub, loc.sub])
  })
  Object.values(CROPS).forEach((c) => {
    const loc = packOf(lang).crop[c.id]
    if (c.name && loc) pairs.push([c.name, loc])
  })
  Object.entries(GROUPS).forEach(([id, g]) => {
    const loc = packOf(lang).group[id]
    if (g.name && loc) pairs.push([g.name, loc])
  })
  SEASONS.forEach((s) => {
    const loc = packOf(lang).season[s.id]
    if (!loc) return
    if (s.name) pairs.push([s.name, loc.name])
    if (s.hint) pairs.push([s.hint, loc.hint])
  })
  WEATHER.forEach((w) => {
    const loc = packOf(lang).weather[w.id]
    if (!loc) return
    if (w.name) pairs.push([w.name, loc.name])
    if (w.text) pairs.push([w.text, loc.text])
  })
  KISAN_CARDS.forEach((c) => {
    const loc = packOf(lang).kisan[c.id]
    if (!loc) return
    if (c.title) pairs.push([c.title, loc.title])
    if (c.text) pairs.push([c.text, loc.text])
  })
  MANDI_CARDS.forEach((c) => {
    const loc = packOf(lang).mandi[c.id]
    if (!loc) return
    if (c.title) pairs.push([c.title, loc.title])
    if (c.text) pairs.push([c.text, loc.text])
  })
  Object.keys(STAGE_KEY).forEach((id) => {
    pairs.push([id, tLang(lang, STAGE_KEY[id])])
  })
  pairs.push(['Rs ', tLang(lang, 'rs')])
  pairs.sort((a, b) => b[0].length - a[0].length)
  return pairs
}

const SWAP = {}

function swaps(lang) {
  if (!SWAP[lang]) SWAP[lang] = replacementsFor(lang)
  return SWAP[lang]
}

export function localizeNames(text) {
  if (text == null || text === '') return ''
  const lang = currentLang()
  if (lang === 'en' || !packOf(lang)) return String(text)
  let out = String(text)
  swaps(lang).forEach(([from, to]) => {
    if (from && to && from !== to) out = out.split(from).join(to)
  })
  return out
}

export function diaryDisplay(e) {
  const text = typeof e === 'string' ? e : (e && e.text) || ''
  return localizeNames(text)
}

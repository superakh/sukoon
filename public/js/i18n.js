/**
 * Sukoon i18n — Internationalization System
 * Supports: EN, HI, UR, AR, ES, FR
 * Warm, calming language for mental wellness.
 */
(function () {
  'use strict';

  var translations = {

    /* ====================================================================
       NAVIGATION  (used on ALL pages)
       ==================================================================== */
    nav: {
      breathe:  { en: 'Breathe',   hi: 'साँस',      ur: 'سانس',      ar: 'تنفّس',       es: 'Respirar',   fr: 'Respirer' },
      meditate: { en: 'Meditate',  hi: 'ध्यान',      ur: 'مراقبہ',     ar: 'تأمّل',       es: 'Meditar',    fr: 'Méditer' },
      sounds:   { en: 'Sounds',    hi: 'ध्वनि',      ur: 'آوازیں',     ar: 'أصوات',       es: 'Sonidos',    fr: 'Sons' },
      journal:  { en: 'Journal',   hi: 'डायरी',      ur: 'ڈائری',      ar: 'يوميّات',     es: 'Diario',     fr: 'Journal' },
      friend:   { en: 'AI Friend', hi: 'AI मित्र',   ur: 'AI دوست',   ar: 'صديق AI',     es: 'Amigo IA',   fr: 'Ami IA' },
      wisdom:   { en: 'Wisdom',    hi: 'ज्ञान',      ur: 'حکمت',      ar: 'حكمة',        es: 'Sabiduría',  fr: 'Sagesse' },
      quotes:   { en: 'Quotes',    hi: 'उद्धरण',     ur: 'اقتباسات',   ar: 'اقتباسات',    es: 'Citas',      fr: 'Citations' },
      videos:   { en: 'Videos',    hi: 'वीडियो',     ur: 'ویڈیوز',     ar: 'فيديوهات',    es: 'Videos',     fr: 'Vidéos' },
      privacy:  { en: 'Privacy',   hi: 'गोपनीयता',   ur: 'رازداری',    ar: 'الخصوصيّة',   es: 'Privacidad', fr: 'Confidentialité' }
    },

    /* ====================================================================
       LANDING / INDEX PAGE
       ==================================================================== */
    hero: {
      label:       { en: 'Free for everyone',                                                hi: 'सबके लिए मुफ़्त',                                        ur: 'سب کے لیے مفت',                                      ar: 'مجّاني للجميع',                                       es: 'Gratis para todos',                                        fr: 'Gratuit pour tous' },
      heading:     { en: 'Find your peace.',                                                  hi: 'अपनी शांति पाइए।',                                      ur: 'اپنا سکون پائیں۔',                                   ar: 'اعثر على سكينتك.',                                    es: 'Encuentra tu paz.',                                        fr: 'Trouvez votre paix.' },
      subtitle:    { en: 'Sukoon is a free mental wellness platform with breathing exercises, meditation, ambient sounds, mood tracking, and an AI companion. For every soul on Earth.',
                     hi: 'सुकून एक मुफ़्त मानसिक स्वास्थ्य मंच है — श्वास, ध्यान, प्राकृतिक ध्वनियाँ, मूड ट्रैकिंग और AI साथी। हर आत्मा के लिए।',
                     ur: 'سکون ایک مفت ذہنی صحت کا پلیٹ فارم ہے — سانس، مراقبہ، قدرتی آوازیں، موڈ ٹریکنگ اور AI ساتھی۔ ہر روح کے لیے۔',
                     ar: 'سكون منصّة مجّانية للعافية النفسيّة — تنفّس، تأمّل، أصوات طبيعيّة، تتبّع المزاج، ورفيق ذكاء اصطناعي. لكلّ روح على الأرض.',
                     es: 'Sukoon es una plataforma gratuita de bienestar mental con ejercicios de respiración, meditación, sonidos ambientales, seguimiento del ánimo y un compañero de IA. Para cada alma en la Tierra.',
                     fr: 'Sukoon est une plateforme gratuite de bien-être mental avec exercices de respiration, méditation, sons ambiants, suivi de l\'humeur et un compagnon IA. Pour chaque âme sur Terre.' },
      trust:       { en: 'No account \u00b7 No tracking \u00b7 No cost',                     hi: 'कोई अकाउंट नहीं \u00b7 कोई ट्रैकिंग नहीं \u00b7 कोई शुल्क नहीं',
                     ur: 'کوئی اکاؤنٹ نہیں \u00b7 کوئی ٹریکنگ نہیں \u00b7 کوئی لاگت نہیں', ar: 'بدون حساب \u00b7 بدون تتبّع \u00b7 بدون تكلفة',
                     es: 'Sin cuenta \u00b7 Sin rastreo \u00b7 Sin costo',                    fr: 'Sans compte \u00b7 Sans pistage \u00b7 Sans frais' },
      cta_breathe: { en: 'Start Breathing',   hi: 'साँस लेना शुरू करें',    ur: 'سانس لینا شروع کریں',     ar: 'ابدأ التنفّس',       es: 'Empezar a respirar',       fr: 'Commencer à respirer' },
      cta_friend:  { en: 'Talk to a Friend',  hi: 'दोस्त से बात करें',      ur: 'دوست سے بات کریں',        ar: 'تحدّث مع صديق',      es: 'Habla con un amigo',       fr: 'Parler à un ami' }
    },
    stats: {
      tools:     { en: 'Free Tools',       hi: 'मुफ़्त उपकरण',       ur: 'مفت ٹولز',          ar: 'أدوات مجّانية',        es: 'Herramientas gratis',  fr: 'Outils gratuits' },
      languages: { en: 'Languages',        hi: 'भाषाएँ',             ur: 'زبانیں',            ar: 'لغات',                es: 'Idiomas',              fr: 'Langues' },
      data:      { en: 'Data Collected',   hi: 'डेटा एकत्र',        ur: 'ڈیٹا جمع',          ar: 'بيانات مُجمَّعة',     es: 'Datos recopilados',    fr: 'Données collectées' },
      peace:     { en: 'Peace',            hi: 'शांति',              ur: 'سکون',              ar: 'سلام',                es: 'Paz',                  fr: 'Paix' }
    },
    features: {
      label:       { en: 'FEATURES',                                       hi: 'विशेषताएँ',                     ur: 'خصوصیات',                  ar: 'المزايا',                  es: 'FUNCIONES',                    fr: 'FONCTIONNALITÉS' },
      heading:     { en: 'Everything you need to feel better',             hi: 'बेहतर महसूस करने के लिए सब कुछ', ur: 'بہتر محسوس کرنے کے لیے سب کچھ', ar: 'كلّ ما تحتاجه لتشعر بالتحسّن', es: 'Todo lo que necesitas para sentirte mejor', fr: 'Tout ce qu\'il faut pour se sentir mieux' },
      sub:         { en: 'Simple, beautiful tools designed with clinical mindfulness principles. Each one crafted to help you pause, reflect, and restore balance.',
                     hi: 'सरल, सुंदर उपकरण जो माइंडफुलनेस के सिद्धांतों पर बने हैं। रुकें, सोचें, संतुलन पाएँ।',
                     ur: 'سادہ، خوبصورت ٹولز جو ذہن سازی کے اصولوں پر بنائے گئے ہیں۔ رکیں، سوچیں، توازن پائیں۔',
                     ar: 'أدوات بسيطة وجميلة مبنيّة على مبادئ اليقظة الذهنيّة. توقّف، تأمّل، واستعد توازنك.',
                     es: 'Herramientas simples y hermosas basadas en principios de atención plena. Detente, reflexiona y recupera tu equilibrio.',
                     fr: 'Des outils simples et beaux, conçus selon les principes de la pleine conscience. Pause, réflexion, équilibre retrouvé.' },
      card_breathe_title:    { en: 'Breathe',   hi: 'साँस',    ur: 'سانس',    ar: 'تنفّس',   es: 'Respirar',   fr: 'Respirer' },
      card_breathe_desc:     { en: 'Guided breathing exercises with 4-7-8, box breathing, and more. Visual circle animation syncs with each phase.',
                               hi: 'गाइडेड श्वास अभ्यास — 4-7-8, बॉक्स ब्रीदिंग और बहुत कुछ।',
                               ur: 'گائیڈڈ سانس کی مشقیں — 4-7-8، باکس بریتھنگ اور بہت کچھ۔',
                               ar: 'تمارين تنفّس موجّهة — 4-7-8، التنفّس المربّع وغيرها.',
                               es: 'Ejercicios guiados de respiración: 4-7-8, respiración cuadrada y más.',
                               fr: 'Exercices de respiration guidés : 4-7-8, respiration carrée et plus.' },
      card_meditate_title:   { en: 'Meditate',  hi: 'ध्यान',   ur: 'مراقبہ',  ar: 'تأمّل',   es: 'Meditar',    fr: 'Méditer' },
      card_meditate_desc:    { en: 'Timer-based meditation with ambient backgrounds. Set your duration, choose a soundscape, and find stillness.',
                               hi: 'टाइमर के साथ ध्यान। अवधि चुनें, ध्वनि चुनें, शांति पाएँ।',
                               ur: 'ٹائمر کے ساتھ مراقبہ۔ مدت چنیں، آواز چنیں، سکون پائیں۔',
                               ar: 'تأمّل بمؤقّت. حدّد المدّة، اختر خلفيّة صوتيّة، واعثر على السكينة.',
                               es: 'Meditación con temporizador y fondos sonoros. Elige la duración, escoge un paisaje sonoro y encuentra la quietud.',
                               fr: 'Méditation minutée avec ambiances sonores. Choisissez la durée, un paysage sonore et trouvez le calme.' },
      card_sounds_title:     { en: 'Sounds',    hi: 'ध्वनि',   ur: 'آوازیں',  ar: 'أصوات',   es: 'Sonidos',    fr: 'Sons' },
      card_sounds_desc:      { en: 'Mix ambient soundscapes: rain, ocean, forest, birdsong. Layer multiple tracks and adjust each volume.',
                               hi: 'प्राकृतिक ध्वनियाँ मिलाएँ: बारिश, समुद्र, जंगल। हर ट्रैक का वॉल्यूम बदलें।',
                               ur: 'قدرتی آوازیں ملائیں: بارش، سمندر، جنگل۔ ہر ٹریک کا والیوم بدلیں۔',
                               ar: 'امزج أصوات الطبيعة: مطر، محيط، غابة. اضبط مستوى كلّ صوت.',
                               es: 'Mezcla paisajes sonoros: lluvia, océano, bosque. Ajusta el volumen de cada pista.',
                               fr: 'Mélangez des ambiances : pluie, océan, forêt. Réglez le volume de chaque piste.' },
      card_journal_title:    { en: 'Journal',    hi: 'डायरी',   ur: 'ڈائری',   ar: 'يوميّات', es: 'Diario',     fr: 'Journal' },
      card_journal_desc:     { en: 'Private mood tracking with daily prompts. Write freely, track patterns, and understand your emotional rhythms.',
                               hi: 'निजी मूड ट्रैकिंग। स्वतंत्र रूप से लिखें, पैटर्न जानें।',
                               ur: 'نجی موڈ ٹریکنگ۔ آزادی سے لکھیں، اپنے جذبات سمجھیں۔',
                               ar: 'تتبّع مزاج خاصّ. اكتب بحرّيّة وتعرّف على أنماطك العاطفيّة.',
                               es: 'Seguimiento privado del estado de ánimo. Escribe libremente y comprende tus ritmos emocionales.',
                               fr: 'Suivi privé de l\'humeur. Écrivez librement et comprenez vos rythmes émotionnels.' },
      card_friend_title:     { en: 'AI Friend',  hi: 'AI दोस्त', ur: 'AI دوست', ar: 'صديق AI', es: 'Amigo IA',   fr: 'Ami IA' },
      card_friend_desc:      { en: 'A compassionate AI companion trained in CBT and active listening. Talk anytime, in your language, judgment-free.',
                               hi: 'एक सहानुभूतिपूर्ण AI साथी। अपनी भाषा में, बिना किसी निर्णय के बात करें।',
                               ur: 'ایک ہمدرد AI ساتھی۔ اپنی زبان میں، بغیر کسی فیصلے کے بات کریں۔',
                               ar: 'رفيق ذكاء اصطناعي رحيم. تحدّث بلغتك، دون أيّ حكم.',
                               es: 'Un compañero de IA compasivo. Habla en tu idioma, sin juicio.',
                               fr: 'Un compagnon IA bienveillant. Parlez dans votre langue, sans jugement.' },
      card_wisdom_title:     { en: 'Wisdom',     hi: 'ज्ञान',   ur: 'حکمت',   ar: 'حكمة',    es: 'Sabiduría',  fr: 'Sagesse' },
      card_wisdom_desc:      { en: 'Curated insights from Rumi, Kabir, Marcus Aurelius, Thich Nhat Hanh, and timeless philosophical traditions.',
                               hi: 'रूमी, कबीर, मार्कस ऑरेलियस, थिच नात हान्ह और कालजयी दर्शन से अंतर्दृष्टि।',
                               ur: 'رومی، کبیر، مارکس اوریلیس، تھک نھات ہان اور لازوال فلسفوں سے بصیرت۔',
                               ar: 'رؤى من الرومي وكبير وماركوس أوريليوس وتيك نات هان وتراث فلسفيّ خالد.',
                               es: 'Sabiduría de Rumi, Kabir, Marco Aurelio, Thich Nhat Hanh y tradiciones filosóficas atemporales.',
                               fr: 'Sagesse de Rumi, Kabir, Marc Aurèle, Thich Nhat Hanh et traditions philosophiques intemporelles.' }
    },
    why: {
      label:     { en: 'PHILOSOPHY',                                       hi: 'दर्शन',                        ur: 'فلسفہ',                    ar: 'الفلسفة',                  es: 'FILOSOFÍA',                    fr: 'PHILOSOPHIE' },
      heading:   { en: 'Why Sukoon?',                                      hi: 'सुकून क्यों?',                  ur: 'سکون کیوں؟',               ar: 'لماذا سكون؟',              es: '¿Por qué Sukoon?',             fr: 'Pourquoi Sukoon ?' },
      free:      { en: 'Free Forever',     hi: 'हमेशा मुफ़्त',     ur: 'ہمیشہ مفت',       ar: 'مجّاني للأبد',     es: 'Gratis para siempre',  fr: 'Gratuit pour toujours' },
      private:   { en: 'Fully Private',    hi: 'पूरी तरह निजी',    ur: 'مکمل نجی',        ar: 'خاصّ بالكامل',     es: 'Totalmente privado',   fr: 'Entièrement privé' },
      multi:     { en: 'Multilingual',     hi: 'बहुभाषी',          ur: 'کثیر اللسان',      ar: 'متعدّد اللغات',    es: 'Multilingüe',          fr: 'Multilingue' },
      love:      { en: 'Made with Love',   hi: 'प्यार से बनाया',   ur: 'محبت سے بنایا',    ar: 'صُنع بحبّ',        es: 'Hecho con amor',       fr: 'Fait avec amour' }
    },
    quote_section: {
      label:    { en: "TODAY'S THOUGHT",   hi: 'आज का विचार',      ur: 'آج کا خیال',       ar: 'فكرة اليوم',       es: 'PENSAMIENTO DEL DÍA',  fr: 'PENSÉE DU JOUR' },
      refresh:  { en: 'New thought',       hi: 'नया विचार',        ur: 'نیا خیال',          ar: 'فكرة جديدة',       es: 'Nuevo pensamiento',    fr: 'Nouvelle pensée' }
    },

    /* ====================================================================
       BREATHE PAGE
       ==================================================================== */
    breathe: {
      technique_478:     { en: '4-7-8 Calm',      hi: '4-7-8 शांति',       ur: '4-7-8 سکون',        ar: '4-7-8 هدوء',        es: '4-7-8 Calma',       fr: '4-7-8 Calme' },
      technique_box:     { en: 'Box Breathing',    hi: 'बॉक्स ब्रीदिंग',   ur: 'باکس بریتھنگ',       ar: 'التنفّس المربّع',   es: 'Respiración cuadrada', fr: 'Respiration carrée' },
      technique_deep:    { en: 'Deep Relax',       hi: 'गहरा विश्राम',      ur: 'گہرا آرام',          ar: 'استرخاء عميق',      es: 'Relajación profunda', fr: 'Détente profonde' },
      technique_energize:{ en: 'Energize',         hi: 'ऊर्जा',            ur: 'توانائی',             ar: 'تنشيط',             es: 'Energizar',         fr: 'Énergiser' },
      phase_in:          { en: 'Breathe In',       hi: 'श्वास लें',        ur: 'سانس لیں',            ar: 'شهيق',              es: 'Inspira',           fr: 'Inspirez' },
      phase_hold:        { en: 'Hold',             hi: 'रोकें',            ur: 'روکیں',               ar: 'احبس',              es: 'Mantén',            fr: 'Retenez' },
      phase_out:         { en: 'Breathe Out',      hi: 'श्वास छोड़ें',     ur: 'سانس چھوڑیں',         ar: 'زفير',              es: 'Exhala',            fr: 'Expirez' },
      ready:             { en: 'Ready',            hi: 'तैयार',            ur: 'تیار',                ar: 'جاهز',              es: 'Listo',             fr: 'Prêt' },
      start:             { en: 'Begin Session',    hi: 'सत्र शुरू करें',    ur: 'سیشن شروع کریں',      ar: 'ابدأ الجلسة',       es: 'Iniciar sesión',    fr: 'Commencer la séance' },
      stop:              { en: 'End Session',      hi: 'सत्र समाप्त करें',  ur: 'سیشن ختم کریں',       ar: 'إنهاء الجلسة',      es: 'Terminar sesión',   fr: 'Terminer la séance' },
      cycle:             { en: 'Cycle',            hi: 'चक्र',             ur: 'چکر',                 ar: 'دورة',              es: 'Ciclo',             fr: 'Cycle' },
      complete:          { en: 'Complete',         hi: 'पूर्ण',            ur: 'مکمل',                ar: 'مكتمل',             es: 'Completo',          fr: 'Terminé' },
      technique_label:   { en: 'TECHNIQUE',        hi: 'तकनीक',           ur: 'تکنیک',               ar: 'الأسلوب',           es: 'TÉCNICA',           fr: 'TECHNIQUE' },
      inhale:            { en: 'Inhale',           hi: 'श्वास',           ur: 'سانس لیں',            ar: 'شهيق',              es: 'Inspira',           fr: 'Inspirez' },
      exhale:            { en: 'Exhale',           hi: 'उच्छ्वास',        ur: 'سانس چھوڑیں',         ar: 'زفير',              es: 'Exhala',            fr: 'Expirez' }
    },

    /* ====================================================================
       MEDITATE PAGE
       ==================================================================== */
    meditate: {
      ready:          { en: 'Ready',            hi: 'तैयार',           ur: 'تیار',           ar: 'جاهز',           es: 'Listo',         fr: 'Prêt' },
      meditating:     { en: 'Meditating',       hi: 'ध्यान में',       ur: 'مراقبے میں',     ar: 'في تأمّل',       es: 'Meditando',     fr: 'En méditation' },
      paused:         { en: 'Paused',           hi: 'रुका हुआ',        ur: 'رکا ہوا',        ar: 'متوقّف',         es: 'Pausado',       fr: 'En pause' },
      complete:       { en: 'Complete',         hi: 'पूर्ण',           ur: 'مکمل',           ar: 'مكتمل',          es: 'Completo',      fr: 'Terminé' },
      start:          { en: 'Start',            hi: 'शुरू करें',       ur: 'شروع کریں',      ar: 'ابدأ',           es: 'Iniciar',       fr: 'Commencer' },
      pause:          { en: 'Pause',            hi: 'रुकें',           ur: 'رکیں',           ar: 'إيقاف',          es: 'Pausa',         fr: 'Pause' },
      resume:         { en: 'Resume',           hi: 'जारी रखें',       ur: 'جاری رکھیں',     ar: 'استئناف',        es: 'Reanudar',      fr: 'Reprendre' },
      reset:          { en: 'Reset',            hi: 'रीसेट',           ur: 'ری سیٹ',         ar: 'إعادة تعيين',    es: 'Reiniciar',     fr: 'Réinitialiser' },
      silence:        { en: 'Silence',          hi: 'मौन',             ur: 'خاموشی',         ar: 'صمت',            es: 'Silencio',      fr: 'Silence' },
      rain:           { en: 'Rain',             hi: 'बारिश',           ur: 'بارش',           ar: 'مطر',            es: 'Lluvia',        fr: 'Pluie' },
      ocean:          { en: 'Ocean',            hi: 'समुद्र',          ur: 'سمندر',          ar: 'محيط',           es: 'Océano',        fr: 'Océan' },
      streak:         { en: 'Day',              hi: 'दिन',             ur: 'دن',             ar: 'يوم',            es: 'Día',           fr: 'Jour' },
      duration:       { en: 'Duration',         hi: 'अवधि',           ur: 'مدت',            ar: 'المدّة',         es: 'Duración',      fr: 'Durée' },
      day_streak:     { en: 'Day Streak',       hi: 'दिनों की लय',     ur: 'دنوں کا سلسلہ',  ar: 'تتابع الأيّام',  es: 'Racha de días', fr: 'Jours consécutifs' },
      namaste:        { en: 'Namaste',          hi: 'नमस्ते',          ur: 'نمستے',          ar: 'ناماستي',        es: 'Namasté',       fr: 'Namasté' },
      continue_btn:   { en: 'Continue',         hi: 'जारी रखें',       ur: 'جاری رکھیں',     ar: 'متابعة',         es: 'Continuar',     fr: 'Continuer' }
    },

    /* ====================================================================
       SOUNDS PAGE
       ==================================================================== */
    sounds: {
      title:       { en: 'Ambient Sounds',                                    hi: 'प्राकृतिक ध्वनियाँ',                  ur: 'قدرتی آوازیں',                  ar: 'أصوات محيطة',                    es: 'Sonidos ambientales',                    fr: 'Sons ambiants' },
      subtitle:    { en: 'Mix calming nature sounds to create your perfect atmosphere.',
                     hi: 'शांत प्रकृति की ध्वनियों का मिश्रण बनाएँ।',
                     ur: 'پرسکون قدرتی آوازوں کا مرکب بنائیں۔',
                     ar: 'امزج أصوات الطبيعة لخلق أجوائك المثاليّة.',
                     es: 'Mezcla sonidos relajantes de la naturaleza para crear tu atmósfera perfecta.',
                     fr: 'Mélangez des sons apaisants de la nature pour créer votre atmosphère idéale.' },
      master:      { en: 'Master Volume',     hi: 'मुख्य आवाज़',      ur: 'ماسٹر والیوم',     ar: 'مستوى الصوت الرئيسي', es: 'Volumen principal',    fr: 'Volume principal' },
      rain:        { en: 'Rain',              hi: 'बारिश',            ur: 'بارش',             ar: 'مطر',              es: 'Lluvia',               fr: 'Pluie' },
      rain_desc:   { en: 'Gentle rainfall on leaves and rooftops',    hi: 'पत्तों और छतों पर हल्की बारिश',  ur: 'پتوں اور چھتوں پر ہلکی بارش', ar: 'هطول خفيف على الأوراق والسطوح', es: 'Lluvia suave sobre hojas y tejados', fr: 'Pluie douce sur les feuilles et les toits' },
      ocean:       { en: 'Ocean Waves',       hi: 'समुद्री लहरें',     ur: 'سمندر کی لہریں',   ar: 'أمواج المحيط',     es: 'Olas del mar',         fr: 'Vagues de l\'océan' },
      ocean_desc:  { en: 'Rhythmic waves rolling onto shore',         hi: 'तट पर आती लयबद्ध लहरें',        ur: 'ساحل پر آتی لہریں',        ar: 'أمواج إيقاعيّة تتدحرج إلى الشاطئ', es: 'Olas rítmicas llegando a la orilla',  fr: 'Vagues rythmiques roulant vers le rivage' },
      birds:       { en: 'Forest Birds',      hi: 'जंगल की चिड़ियाँ',  ur: 'جنگل کے پرندے',    ar: 'طيور الغابة',      es: 'Pájaros del bosque',   fr: 'Oiseaux de la forêt' },
      birds_desc:  { en: 'Woodland birdsong at dawn',                 hi: 'सुबह जंगल में चिड़ियों का गीत',   ur: 'صبح جنگل میں پرندوں کا گیت', ar: 'تغريد طيور الغابة عند الفجر', es: 'Canto de aves al amanecer',  fr: 'Chant d\'oiseaux à l\'aube' },
      thunder:     { en: 'Thunder',           hi: 'गरज',              ur: 'گرج',              ar: 'رعد',              es: 'Trueno',               fr: 'Tonnerre' },
      thunder_desc:{ en: 'Distant rumbling thunderstorm',             hi: 'दूर गरजता तूफ़ान',                ur: 'دور سے گرجتا طوفان',       ar: 'عاصفة رعديّة بعيدة',          es: 'Tormenta eléctrica lejana',     fr: 'Orage grondant au loin' },
      fire:        { en: 'Fireplace',         hi: 'अलाव',             ur: 'آگ',               ar: 'مدفأة',            es: 'Chimenea',             fr: 'Cheminée' },
      fire_desc:   { en: 'Warm crackling firewood',                   hi: 'गरम चटकती लकड़ी',                ur: 'گرم چٹختی لکڑی',           ar: 'حطب يتقصّف بدفء',            es: 'Leña crepitante y cálida',      fr: 'Feu de bois crépitant' },
      wind:        { en: 'Wind',              hi: 'हवा',              ur: 'ہوا',              ar: 'رياح',             es: 'Viento',               fr: 'Vent' },
      wind_desc:   { en: 'Soft breeze through the trees',             hi: 'पेड़ों से गुज़रती हल्की हवा',     ur: 'درختوں سے گزرتی ہلکی ہوا', ar: 'نسيم خفيف عبر الأشجار',      es: 'Brisa suave entre los árboles', fr: 'Brise légère à travers les arbres' },
      creek:       { en: 'Creek',             hi: 'झरना',             ur: 'ندی',              ar: 'جدول',             es: 'Arroyo',               fr: 'Ruisseau' },
      creek_desc:  { en: 'Babbling brook over smooth stones',         hi: 'चिकने पत्थरों पर बहता झरना',     ur: 'ہموار پتھروں پر بہتی ندی',  ar: 'جدول يتدفّق فوق حصى ناعمة',  es: 'Arroyo murmurante sobre piedras lisas', fr: 'Ruisseau murmurant sur des galets lisses' },
      crickets:    { en: 'Night Crickets',    hi: 'रात के झींगुर',    ur: 'رات کے جھینگر',    ar: 'صراصير الليل',     es: 'Grillos nocturnos',    fr: 'Grillons nocturnes' },
      crickets_desc:{ en: 'Chirping crickets under a starry sky',     hi: 'तारों भरी रात में झींगुरों की आवाज़', ur: 'ستاروں بھری رات میں جھینگروں کی آواز', ar: 'صرّار الليل تحت سماء مرصّعة بالنجوم', es: 'Grillos cantando bajo un cielo estrellado', fr: 'Grillons chantant sous un ciel étoilé' },
      mix_rainy:   { en: 'Rainy Night',       hi: 'बरसात की रात',     ur: 'بارش کی رات',      ar: 'ليلة ماطرة',       es: 'Noche lluviosa',       fr: 'Nuit pluvieuse' },
      mix_beach:   { en: 'Beach Morning',     hi: 'समुद्र तट की सुबह', ur: 'ساحل کی صبح',      ar: 'صباح الشاطئ',      es: 'Mañana en la playa',   fr: 'Matin à la plage' },
      mix_forest:  { en: 'Forest Walk',       hi: 'जंगल की सैर',      ur: 'جنگل کی سیر',      ar: 'نزهة في الغابة',   es: 'Paseo por el bosque',  fr: 'Promenade en forêt' },
      mix_cozy:    { en: 'Cozy Cabin',        hi: 'आरामदायक केबिन',   ur: 'آرام دہ کیبن',     ar: 'كوخ دافئ',         es: 'Cabaña acogedora',     fr: 'Cabane chaleureuse' },
      mix_starry:  { en: 'Starry Night',      hi: 'तारों भरी रात',    ur: 'ستاروں بھری رات',  ar: 'ليلة مرصّعة بالنجوم', es: 'Noche estrellada',  fr: 'Nuit étoilée' },
      presets:     { en: 'Quick Mix Presets',  hi: 'त्वरित मिश्रण',    ur: 'فوری مکسز',        ar: 'مزيج سريع',        es: 'Mezclas rápidas',      fr: 'Mélanges rapides' },
      sleep_timer: { en: 'Sleep Timer',       hi: 'नींद टाइमर',       ur: 'نیند ٹائمر',       ar: 'مؤقّت النوم',      es: 'Temporizador de sueño', fr: 'Minuteur sommeil' },
      timer_off:   { en: 'Off',               hi: 'बंद',              ur: 'بند',              ar: 'إيقاف',            es: 'Apagado',              fr: 'Arrêt' },
      cancel:      { en: 'Cancel',            hi: 'रद्द करें',        ur: 'منسوخ کریں',       ar: 'إلغاء',            es: 'Cancelar',             fr: 'Annuler' }
    },

    /* ====================================================================
       JOURNAL PAGE
       ==================================================================== */
    journal: {
      title:       { en: 'How are you feeling?',                      hi: 'आप कैसा महसूस कर रहे हैं?',     ur: 'آپ کیسا محسوس کر رہے ہیں؟', ar: 'كيف تشعر الآن؟',              es: '¿Cómo te sientes?',                     fr: 'Comment vous sentez-vous ?' },
      subtitle:    { en: 'Track your mood, write your thoughts. Your private space.',
                     hi: 'अपना मूड ट्रैक करें, विचार लिखें। आपका निजी स्थान।',
                     ur: 'اپنا موڈ ٹریک کریں، خیالات لکھیں۔ آپ کی نجی جگہ۔',
                     ar: 'تتبّع مزاجك، اكتب أفكارك. مساحتك الخاصّة.',
                     es: 'Registra tu ánimo, escribe tus pensamientos. Tu espacio privado.',
                     fr: 'Suivez votre humeur, écrivez vos pensées. Votre espace privé.' },
      gdpr:        { en: 'Your journal is stored only on this device. Nothing is sent to any server.',
                     hi: 'आपकी डायरी केवल इस डिवाइस पर स्टोर होती है। कुछ भी किसी सर्वर पर नहीं भेजा जाता।',
                     ur: 'آپ کی ڈائری صرف اس ڈیوائس پر محفوظ ہے۔ کچھ بھی کسی سرور کو نہیں بھیجا جاتا۔',
                     ar: 'يوميّاتك محفوظة فقط على جهازك. لا يُرسَل أيّ شيء إلى أيّ خادم.',
                     es: 'Tu diario se almacena solo en este dispositivo. Nada se envía a ningún servidor.',
                     fr: 'Votre journal est stocké uniquement sur cet appareil. Rien n\'est envoyé à aucun serveur.' },
      how_feeling: { en: 'Choose your mood',                          hi: 'अपना मूड चुनें',              ur: 'اپنا موڈ چنیں',             ar: 'اختر مزاجك',                  es: 'Elige tu estado de ánimo',               fr: 'Choisissez votre humeur' },
      mood_awful:  { en: 'Awful',      hi: 'बहुत बुरा',   ur: 'بہت برا',    ar: 'سيّئ جدًّا',   es: 'Terrible', fr: 'Terrible' },
      mood_bad:    { en: 'Bad',        hi: 'बुरा',        ur: 'برا',        ar: 'سيّئ',        es: 'Mal',      fr: 'Mal' },
      mood_okay:   { en: 'Okay',       hi: 'ठीक',         ur: 'ٹھیک',       ar: 'لا بأس',      es: 'Regular',  fr: 'Correct' },
      mood_good:   { en: 'Good',       hi: 'अच्छा',       ur: 'اچھا',       ar: 'جيّد',        es: 'Bien',     fr: 'Bien' },
      mood_great:  { en: 'Great',      hi: 'बहुत अच्छा',  ur: 'بہت اچھا',   ar: 'رائع',        es: 'Genial',   fr: 'Super' },
      placeholder: { en: 'Write whatever is on your mind... No one will see this but you.',
                     hi: 'जो मन में आए वो लिखें... ये सिर्फ़ आपके लिए है।',
                     ur: 'جو دل میں آئے لکھیں... یہ صرف آپ کے لیے ہے۔',
                     ar: 'اكتب ما يدور في ذهنك... لن يراه أحد سواك.',
                     es: 'Escribe lo que tengas en mente... Nadie lo verá excepto tú.',
                     fr: 'Écrivez ce que vous avez en tête... Personne ne le verra à part vous.' },
      your_thoughts:{ en: 'Your thoughts', hi: 'आपके विचार', ur: 'آپ کے خیالات', ar: 'أفكارك', es: 'Tus pensamientos', fr: 'Vos pensées' },
      save:        { en: 'Save Entry',     hi: 'एंट्री सेव करें',   ur: 'اندراج محفوظ کریں', ar: 'حفظ المدخل',       es: 'Guardar entrada',     fr: 'Enregistrer l\'entrée' },
      export:      { en: 'Export Data',    hi: 'डेटा निर्यात करें',  ur: 'ڈیٹا برآمد کریں',   ar: 'تصدير البيانات',   es: 'Exportar datos',      fr: 'Exporter les données' },
      saved:       { en: 'Entry saved',    hi: 'एंट्री सेव हो गई',  ur: 'اندراج محفوظ ہو گیا', ar: 'تمّ الحفظ',      es: 'Entrada guardada',    fr: 'Entrée enregistrée' },
      history:     { en: 'Mood History',   hi: 'मूड इतिहास',         ur: 'موڈ ہسٹری',         ar: 'سجلّ المزاج',      es: 'Historial de ánimo',  fr: 'Historique de l\'humeur' },
      history_sub: { en: 'Your 30-day emotional journey',            hi: 'आपकी 30 दिनों की भावनात्मक यात्रा', ur: 'آپ کا 30 دنوں کا جذباتی سفر', ar: 'رحلتك العاطفيّة خلال 30 يومًا', es: 'Tu viaje emocional de 30 días', fr: 'Votre parcours émotionnel sur 30 jours' },
      last_30:     { en: 'Last 30 Days',   hi: 'पिछले 30 दिन',      ur: 'پچھلے 30 دن',       ar: 'آخر 30 يومًا',     es: 'Últimos 30 días',     fr: 'Les 30 derniers jours' },
      recent:      { en: 'Recent Entries',  hi: 'हाल की प्रविष्टियाँ', ur: 'حالیہ اندراجات',    ar: 'الإدخالات الأخيرة', es: 'Entradas recientes', fr: 'Entrées récentes' },
      recent_sub:  { en: 'Your last 5 journal entries',              hi: 'आपकी पिछली 5 डायरी प्रविष्टियाँ', ur: 'آپ کے پچھلے 5 ڈائری اندراجات', ar: 'آخر 5 إدخالات في يوميّاتك', es: 'Tus últimas 5 entradas', fr: 'Vos 5 dernières entrées' },
      empty:       { en: 'No entries yet. Write your first one above.', hi: 'अभी कोई प्रविष्टि नहीं। ऊपर अपनी पहली लिखें।', ur: 'ابھی کوئی اندراج نہیں۔ اوپر اپنا پہلا لکھیں۔', ar: 'لا يوجد إدخالات بعد. اكتب أوّل واحد أعلاه.', es: 'Aún no hay entradas. Escribe la primera arriba.', fr: 'Pas encore d\'entrées. Écrivez la première ci-dessus.' }
    },

    /* ====================================================================
       AI FRIEND PAGE
       ==================================================================== */
    friend: {
      title:        { en: 'AI Friend',                                hi: 'AI मित्र',                       ur: 'AI دوست',                   ar: 'صديق AI',                   es: 'Amigo IA',                       fr: 'Ami IA' },
      subtitle:     { en: "I'm here to listen. No judgment. No records.",
                      hi: 'मैं सुनने के लिए हूँ। कोई फ़ैसला नहीं। कोई रिकॉर्ड नहीं।',
                      ur: 'میں سننے کے لیے ہوں۔ کوئی فیصلہ نہیں۔ کوئی ریکارڈ نہیں۔',
                      ar: 'أنا هنا لأستمع. لا أحكام. لا سجلّات.',
                      es: 'Estoy aquí para escuchar. Sin juicio. Sin registros.',
                      fr: 'Je suis là pour écouter. Sans jugement. Sans traces.' },
      crisis:       { en: 'Not a therapist. If you are in crisis or need professional help, please reach out:',
                      hi: 'यह चिकित्सक नहीं है। अगर आप संकट में हैं, तो कृपया संपर्क करें:',
                      ur: 'یہ معالج نہیں ہے۔ اگر آپ بحران میں ہیں تو براہ کرم رابطہ کریں:',
                      ar: 'ليس معالجًا. إذا كنت في أزمة، يرجى التواصل:',
                      es: 'No es terapeuta. Si estás en crisis, por favor contacta:',
                      fr: 'Pas un thérapeute. Si vous êtes en crise, veuillez contacter :' },
      gdpr:         { en: "This conversation is NOT saved. When you close this window, it's gone forever.",
                      hi: 'यह बातचीत सेव नहीं होती। विंडो बंद करने पर सब मिट जाएगा।',
                      ur: 'یہ بات چیت محفوظ نہیں ہوتی۔ ونڈو بند کرنے پر سب مٹ جائے گا۔',
                      ar: 'هذه المحادثة لا تُحفَظ. عند إغلاق النافذة، تختفي إلى الأبد.',
                      es: 'Esta conversación NO se guarda. Cuando cierres esta ventana, desaparecerá para siempre.',
                      fr: 'Cette conversation n\'est PAS sauvegardée. Quand vous fermerez cette fenêtre, tout disparaîtra.' },
      placeholder:  { en: 'Type your message...',                     hi: 'अपना संदेश लिखें...',           ur: 'اپنا پیغام لکھیں...',       ar: 'اكتب رسالتك...',             es: 'Escribe tu mensaje...',              fr: 'Écrivez votre message...' },
      send:         { en: 'Send',              hi: 'भेजें',           ur: 'بھیجیں',           ar: 'إرسال',            es: 'Enviar',               fr: 'Envoyer' }
    },

    /* ====================================================================
       WISDOM PAGE
       ==================================================================== */
    wisdom: {
      badge:           { en: 'Spiritual Teachings',                    hi: 'आध्यात्मिक शिक्षाएँ',           ur: 'روحانی تعلیمات',            ar: 'تعاليم روحيّة',              es: 'Enseñanzas espirituales',            fr: 'Enseignements spirituels' },
      title:           { en: 'Soul Wisdom',                            hi: 'आत्मा का ज्ञान',                ur: 'روح کی حکمت',               ar: 'حكمة الروح',                es: 'Sabiduría del alma',                 fr: 'Sagesse de l\'âme' },
      subtitle:        { en: 'Ancient wisdom for the modern soul. Timeless truths to guide your inner journey toward lasting peace.',
                         hi: 'आधुनिक आत्मा के लिए प्राचीन ज्ञान। शाश्वत सत्य जो आपकी आंतरिक यात्रा का मार्गदर्शन करें।',
                         ur: 'جدید روح کے لیے قدیم حکمت۔ لازوال سچائیاں جو آپ کے اندرونی سفر کی رہنمائی کریں۔',
                         ar: 'حكمة قديمة للروح المعاصرة. حقائق خالدة لتوجيه رحلتك الداخليّة نحو سلام دائم.',
                         es: 'Sabiduría ancestral para el alma moderna. Verdades atemporales que guían tu camino interior hacia la paz duradera.',
                         fr: 'Sagesse ancienne pour l\'âme moderne. Des vérités intemporelles pour guider votre voyage intérieur vers une paix durable.' },
      affirmation:     { en: "Today's Affirmation",                    hi: 'आज की पुष्टि',                  ur: 'آج کی تصدیق',               ar: 'تأكيد اليوم',               es: 'Afirmación del día',                 fr: 'Affirmation du jour' },
      new_thought:     { en: 'New Thought',                            hi: 'नया विचार',                    ur: 'نیا خیال',                  ar: 'فكرة جديدة',                es: 'Nuevo pensamiento',                  fr: 'Nouvelle pensée' },
      foundations_label:{ en: 'Core Teachings',                        hi: 'मूल शिक्षाएँ',                  ur: 'بنیادی تعلیمات',             ar: 'التعاليم الأساسيّة',         es: 'Enseñanzas fundamentales',           fr: 'Enseignements fondamentaux' },
      foundations:     { en: 'Foundations of Inner Peace',              hi: 'आंतरिक शांति की नींव',           ur: 'اندرونی سکون کی بنیاد',     ar: 'أسس السلام الداخلي',         es: 'Fundamentos de la paz interior',     fr: 'Fondements de la paix intérieure' },
      practices_label: { en: 'Rituals',                                hi: 'अनुष्ठान',                     ur: 'رسومات',                    ar: 'طقوس',                      es: 'Rituales',                           fr: 'Rituels' },
      practices:       { en: 'Daily Practices',                        hi: 'दैनिक अभ्यास',                  ur: 'روزانہ کے اعمال',            ar: 'ممارسات يوميّة',             es: 'Prácticas diarias',                  fr: 'Pratiques quotidiennes' },
      practices_sub:   { en: 'Simple sacred rituals for morning, midday, and evening to anchor your soul in peace throughout the day.',
                         hi: 'सुबह, दोपहर और शाम के लिए सरल पवित्र अनुष्ठान जो पूरे दिन आपकी आत्मा को शांति में स्थिर रखें।',
                         ur: 'صبح، دوپہر اور شام کے لیے سادہ مقدس رسومات جو پورے دن آپ کی روح کو سکون میں رکھیں۔',
                         ar: 'طقوس بسيطة للصباح والظهيرة والمساء لترسيخ روحك في السلام طوال اليوم.',
                         es: 'Rituales sagrados sencillos para la mañana, el mediodía y la noche que anclan tu alma en la paz.',
                         fr: 'Des rituels simples et sacrés pour le matin, le midi et le soir afin d\'ancrer votre âme dans la paix.' },
      talks:           { en: 'Talks for the Soul',                     hi: 'आत्मा के लिए वार्ताएँ',         ur: 'روح کے لیے گفتگو',          ar: 'محادثات للروح',              es: 'Charlas para el alma',               fr: 'Entretiens pour l\'âme' }
    },

    /* ====================================================================
       QUOTES PAGE
       ==================================================================== */
    quotes: {
      badge:       { en: 'Bilingual Wisdom',   hi: 'द्विभाषी ज्ञान',    ur: 'دو زبانی حکمت',    ar: 'حكمة ثنائيّة اللغة', es: 'Sabiduría bilingüe',   fr: 'Sagesse bilingue' },
      title:       { en: 'Quotes for the Soul', hi: 'आत्मा के लिए उद्धरण', ur: 'روح کے لیے اقتباسات', ar: 'اقتباسات للروح',   es: 'Citas para el alma',   fr: 'Citations pour l\'âme' },
      subtitle:    { en: 'Words that heal, inspire, and awaken. In English and Hindi, for every heart that needs light.',
                     hi: 'शब्द जो उपचार करें, प्रेरित करें और जगाएँ। अंग्रेज़ी और हिंदी में, हर उस दिल के लिए जिसे रोशनी चाहिए।',
                     ur: 'الفاظ جو شفا دیں، حوصلہ دیں اور جگائیں۔ انگریزی اور ہندی میں، ہر اس دل کے لیے جسے روشنی چاہیے۔',
                     ar: 'كلمات تشفي وتُلهم وتُيقظ. بالإنجليزيّة والهنديّة، لكلّ قلب يحتاج نورًا.',
                     es: 'Palabras que sanan, inspiran y despiertan. En inglés y hindi, para cada corazón que necesita luz.',
                     fr: 'Des mots qui guérissent, inspirent et éveillent. En anglais et hindi, pour chaque coeur qui a besoin de lumière.' },
      daily_label: { en: 'Quote of the Moment', hi: 'पल का उद्धरण',      ur: 'لمحے کا اقتباس',    ar: 'اقتباس اللحظة',    es: 'Cita del momento',     fr: 'Citation du moment' },
      refresh:     { en: 'Another Quote',       hi: 'एक और उद्धरण',     ur: 'ایک اور اقتباس',    ar: 'اقتباس آخر',       es: 'Otra cita',            fr: 'Autre citation' },
      filter_all:       { en: 'All',          hi: 'सभी',       ur: 'سب',       ar: 'الكلّ',     es: 'Todas',        fr: 'Toutes' },
      filter_kindness:  { en: 'Kindness',     hi: 'दयालुता',    ur: 'رحمدلی',    ar: 'لطف',       es: 'Bondad',       fr: 'Bienveillance' },
      filter_strength:  { en: 'Strength',     hi: 'शक्ति',      ur: 'طاقت',     ar: 'قوّة',      es: 'Fortaleza',    fr: 'Force' },
      filter_courage:   { en: 'Courage',      hi: 'साहस',       ur: 'ہمت',      ar: 'شجاعة',     es: 'Valor',        fr: 'Courage' },
      filter_wisdom:    { en: 'Wisdom',       hi: 'ज्ञान',      ur: 'حکمت',     ar: 'حكمة',      es: 'Sabiduría',    fr: 'Sagesse' },
      filter_self_talk: { en: 'Self-Talk',    hi: 'आत्म-संवाद', ur: 'خود کلامی', ar: 'حديث الذات', es: 'Diálogo interno', fr: 'Dialogue intérieur' },
      filter_islamic:   { en: 'Islamic',      hi: 'इस्लामी',    ur: 'اسلامی',   ar: 'إسلامي',    es: 'Islámico',     fr: 'Islamique' },
      filter_family:    { en: 'Family',       hi: 'परिवार',     ur: 'خاندان',   ar: 'عائلة',     es: 'Familia',      fr: 'Famille' },
      filter_humor:     { en: 'Humor',        hi: 'हास्य',      ur: 'مزاح',     ar: 'فكاهة',     es: 'Humor',        fr: 'Humour' },
      filter_peace:     { en: 'Peace',        hi: 'शांति',      ur: 'سکون',     ar: 'سلام',      es: 'Paz',          fr: 'Paix' },
      filter_healing:   { en: 'Healing',      hi: 'उपचार',     ur: 'شفا',      ar: 'شفاء',      es: 'Sanación',     fr: 'Guérison' }
    },

    /* ====================================================================
       VIDEOS PAGE
       ==================================================================== */
    videos: {
      title:          { en: 'Videos for the Soul',                     hi: 'आत्मा के लिए वीडियो',           ur: 'روح کے لیے ویڈیوز',          ar: 'فيديوهات للروح',             es: 'Videos para el alma',                fr: 'Vidéos pour l\'âme' },
      subtitle:       { en: 'Inspirational stories, calm music, and guided meditations. Press play and breathe.',
                        hi: 'प्रेरणादायक कहानियाँ, शांत संगीत और ध्यान। प्ले करें और साँस लें।',
                        ur: 'متاثر کن کہانیاں، پرسکون موسیقی اور مراقبہ۔ پلے کریں اور سانس لیں۔',
                        ar: 'قصص ملهمة، موسيقى هادئة، وتأمّلات موجّهة. اضغط تشغيل وتنفّس.',
                        es: 'Historias inspiradoras, música tranquila y meditaciones guiadas. Reproduce y respira.',
                        fr: 'Histoires inspirantes, musique apaisante et méditations guidées. Appuyez sur lecture et respirez.' },
      inspirational:  { en: 'Inspirational',    hi: 'प्रेरणादायक',       ur: 'متاثر کن',          ar: 'ملهمة',             es: 'Inspiracional',        fr: 'Inspirant' },
      calm:           { en: 'Calm Music & Meditation', hi: 'शांत संगीत और ध्यान', ur: 'پرسکون موسیقی اور مراقبہ', ar: 'موسيقى هادئة وتأمّل', es: 'Música tranquila y meditación', fr: 'Musique calme et méditation' }
    },

    /* ====================================================================
       PRIVACY PAGE
       ==================================================================== */
    privacy: {
      title:          { en: 'Privacy & Trust',                         hi: 'गोपनीयता और विश्वास',            ur: 'رازداری اور اعتماد',         ar: 'الخصوصيّة والثقة',           es: 'Privacidad y confianza',             fr: 'Confidentialité et confiance' },
      subtitle:       { en: 'Your peace of mind is our only priority. We built Sukoon to heal, not to harvest.',
                        hi: 'आपकी मानसिक शांति ही हमारी एकमात्र प्राथमिकता है।',
                        ur: 'آپ کا ذہنی سکون ہی ہماری واحد ترجیح ہے۔',
                        ar: 'راحة بالك هي أولويّتنا الوحيدة.',
                        es: 'Tu tranquilidad es nuestra única prioridad. Construimos Sukoon para sanar, no para cosechar.',
                        fr: 'Votre tranquillité d\'esprit est notre seule priorité. Nous avons construit Sukoon pour guérir, pas pour récolter.' },
      zero:           { en: 'Zero Data Collection. Zero Tracking. Zero Compromise.',
                        hi: 'शून्य डेटा संग्रह। शून्य ट्रैकिंग। शून्य समझौता।',
                        ur: 'صفر ڈیٹا جمع۔ صفر ٹریکنگ۔ صفر سمجھوتہ۔',
                        ar: 'صفر جمع بيانات. صفر تتبّع. صفر تنازل.',
                        es: 'Cero recopilación de datos. Cero rastreo. Cero compromisos.',
                        fr: 'Zéro collecte de données. Zéro pistage. Zéro compromis.' },
      promise:        { en: 'Our Promise',       hi: 'हमारा वादा',       ur: 'ہمارا وعدہ',       ar: 'وعدنا',            es: 'Nuestra promesa',      fr: 'Notre promesse' },
      dont:           { en: "What We DON'T Do",  hi: 'हम क्या नहीं करते', ur: 'ہم کیا نہیں کرتے', ar: 'ما لا نفعله',      es: 'Lo que NO hacemos',    fr: 'Ce que nous ne faisons PAS' },
      journal_data:   { en: 'Your Journal & Mood Data', hi: 'आपकी डायरी और मूड डेटा', ur: 'آپ کی ڈائری اور موڈ ڈیٹا', ar: 'بيانات يوميّاتك ومزاجك', es: 'Datos de tu diario y ánimo', fr: 'Données de votre journal et humeur' },
      ai_data:        { en: 'AI Friend Conversations',  hi: 'AI मित्र वार्तालाप',    ur: 'AI دوست کی گفتگو',  ar: 'محادثات صديق AI',     es: 'Conversaciones con Amigo IA', fr: 'Conversations de l\'Ami IA' },
      gdpr:           { en: 'GDPR Compliance',   hi: 'GDPR अनुपालन',      ur: 'GDPR تعمیل',        ar: 'توافق GDPR',        es: 'Cumplimiento GDPR',    fr: 'Conformité RGPD' },
      open_source:    { en: 'Open Source Transparency', hi: 'ओपन सोर्स पारदर्शिता', ur: 'اوپن سورس شفافیت', ar: 'شفافيّة المصدر المفتوح', es: 'Transparencia de código abierto', fr: 'Transparence open source' },
      children:       { en: "Children's Privacy", hi: 'बच्चों की गोपनीयता', ur: 'بچوں کی رازداری',   ar: 'خصوصيّة الأطفال',   es: 'Privacidad de los niños', fr: 'Confidentialité des enfants' },
      contact:        { en: 'Contact',           hi: 'संपर्क',            ur: 'رابطہ',             ar: 'تواصل',             es: 'Contacto',             fr: 'Contact' },
      built_with_love:{ en: 'Built with love, not with data.',
                        hi: 'प्यार से बनाया, डेटा से नहीं।',
                        ur: 'محبت سے بنایا، ڈیٹا سے نہیں۔',
                        ar: 'بُنيَ بالحبّ، لا بالبيانات.',
                        es: 'Construido con amor, no con datos.',
                        fr: 'Construit avec amour, pas avec des données.' }
    },

    /* ====================================================================
       FOOTER  (all pages)
       ==================================================================== */
    footer: {
      mission:     { en: 'Free mental wellness tools for every soul on Earth.',
                     hi: 'पृथ्वी पर हर आत्मा के लिए मुफ़्त मानसिक स्वास्थ्य उपकरण।',
                     ur: 'زمین پر ہر روح کے لیے مفت ذہنی صحت کے اوزار۔',
                     ar: 'أدوات عافية نفسيّة مجّانية لكلّ روح على الأرض.',
                     es: 'Herramientas gratuitas de bienestar mental para cada alma en la Tierra.',
                     fr: 'Outils gratuits de bien-être mental pour chaque âme sur Terre.' },
      privacy_line:{ en: 'Zero data collection',
                     hi: 'शून्य डेटा संग्रह',
                     ur: 'صفر ڈیٹا جمع',
                     ar: 'صفر جمع بيانات',
                     es: 'Cero recopilación de datos',
                     fr: 'Zéro collecte de données' },
      privacy_full:{ en: 'Your data stays on your device. We don\'t collect, store, or sell anything.',
                     hi: 'आपका डेटा आपके डिवाइस पर रहता है। हम कुछ भी एकत्र, संग्रहीत या बेचते नहीं हैं।',
                     ur: 'آپ کا ڈیٹا آپ کے ڈیوائس پر رہتا ہے۔ ہم کچھ بھی جمع، ذخیرہ یا فروخت نہیں کرتے۔',
                     ar: 'بياناتك تبقى على جهازك. لا نجمع ولا نخزّن ولا نبيع أيّ شيء.',
                     es: 'Tus datos permanecen en tu dispositivo. No recopilamos, almacenamos ni vendemos nada.',
                     fr: 'Vos données restent sur votre appareil. Nous ne collectons, ne stockons et ne vendons rien.' },
      copyright:   { en: 'The world needs love, not war.',
                     hi: 'दुनिया को प्यार चाहिए, नफ़रत नहीं।',
                     ur: 'دنیا کو محبت چاہیے، نفرت نہیں۔',
                     ar: 'العالم يحتاج حبًّا، لا حربًا.',
                     es: 'El mundo necesita amor, no guerra.',
                     fr: 'Le monde a besoin d\'amour, pas de guerre.' },
      practice:    { en: 'Practice', hi: 'अभ्यास', ur: 'مشق', ar: 'ممارسة', es: 'Práctica', fr: 'Pratique' },
      explore:     { en: 'Explore',  hi: 'खोजें',  ur: 'دریافت کریں', ar: 'استكشف', es: 'Explorar', fr: 'Explorer' }
    }
  };


  /* ======================================================================
     ENGINE
     ====================================================================== */

  function getNestedValue(obj, path) {
    var keys = path.split('.');
    var cur = obj;
    for (var i = 0; i < keys.length; i++) {
      if (cur === undefined || cur === null) return undefined;
      cur = cur[keys[i]];
    }
    return cur;
  }

  function setLanguage(lang) {
    lang = (lang || 'en').toLowerCase();

    // Persist
    try { localStorage.setItem('sukoon-lang', lang); } catch (e) { /* private mode */ }

    // RTL handling
    var rtlLangs = ['ar', 'ur'];
    if (rtlLangs.indexOf(lang) !== -1) {
      document.documentElement.setAttribute('dir', 'rtl');
      document.documentElement.style.fontFamily = "'Noto Naskh Arabic', 'Noto Sans Arabic', 'Noto Nastaliq Urdu', 'Inter', sans-serif";
      // Load Arabic/Urdu fonts dynamically if not present
      if (!document.getElementById('sukoon-rtl-font')) {
        var link = document.createElement('link');
        link.id = 'sukoon-rtl-font';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap';
        document.head.appendChild(link);
      }
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
      document.documentElement.style.fontFamily = "";
    }

    // Translate all data-i18n elements
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-i18n');
      var val = getNestedValue(translations, key);
      if (val) {
        var text = val[lang] || val['en'] || '';
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = text;
        } else {
          el.textContent = text;
        }
      }
    }

    // Update all language pickers on the page
    var pickers = document.querySelectorAll('.lang-picker, .lang-select');
    for (var j = 0; j < pickers.length; j++) {
      pickers[j].value = lang;
    }
  }

  function getSavedLanguage() {
    try { return localStorage.getItem('sukoon-lang') || 'en'; } catch (e) { return 'en'; }
  }

  /* ======================================================================
     INIT  — runs on every page load
     ====================================================================== */

  // Apply saved language as soon as possible
  var savedLang = getSavedLanguage();

  document.addEventListener('DOMContentLoaded', function () {
    // Set current language
    setLanguage(savedLang);

    // Bind all language selects
    var pickers = document.querySelectorAll('.lang-picker, .lang-select');
    for (var i = 0; i < pickers.length; i++) {
      pickers[i].addEventListener('change', function (e) {
        setLanguage(e.target.value);
      });
    }
  });

  // Expose globally
  window.sukoonI18n = {
    setLanguage: setLanguage,
    translations: translations,
    getNestedValue: getNestedValue,
    getSavedLanguage: getSavedLanguage
  };

})();

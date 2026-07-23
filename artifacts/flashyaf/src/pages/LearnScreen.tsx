import { useState, useMemo, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";

interface Props {
  onNavigate: (screen: string) => void;
}

interface Section {
  id: string;
  icon: string;
  title: string;
  color: string;
  bg: string;
  border: string;
  intro: string;
  bullets: string[];
}

interface Symptom {
  id: string;
  icon: string;
  name: string;
  color: string;
  summary: string;
  whatItIs: string;
  whyItHappens: string;
  howLong: string;
  whatHelps: string[];
  whenToSeeDoctor: string;
  didYouKnow: string;
}

const SYMPTOMS: Symptom[] = [
  {
    id: "hot-flashes",
    icon: "🔥",
    name: "Hot Flashes",
    color: "#FF4500",
    summary: "Sudden intense heat, flushing, and sweating that hits without warning.",
    whatItIs:
      "A sudden wave of heat spreading across your chest, neck, and face — often followed by sweating, redness, and a rapid heartbeat. Your skin may flush and you may feel your heart pounding.",
    whyItHappens:
      "Declining estrogen confuses the hypothalamus (your brain's thermostat). It reads normal body temperature as overheating and triggers your full cooling system — sweating, skin flushing, rapid heart rate.",
    howLong:
      "Average 1–5 minutes per flash; some last up to 30 minutes. Most women experience them for 7–10 years, with frequency peaking in late perimenopause.",
    whatHelps: [
      "Paced deep breathing — shown to reduce frequency by up to 50%",
      "Cool water on wrists and the back of your neck (instant relief)",
      "Handheld fan — airflow is the fastest de-escalator you have",
      "Reduce caffeine, alcohol, and spicy foods — the top three dietary triggers",
      "Hormone therapy — the most effective treatment (70–80% reduction)",
      "SSRIs/SNRIs — evidence-backed non-hormonal option",
    ],
    whenToSeeDoctor:
      "If you're having more than 7 per day, they're severely disrupting sleep or work, or they come with chest pain or shortness of breath.",
    didYouKnow:
      "About 75% of menopausal women experience hot flashes — but 1 in 4 women sail through menopause with few or none at all.",
  },
  {
    id: "night-sweats",
    icon: "🌙",
    name: "Night Sweats",
    color: "#8E44AD",
    summary: "Hot flashes that hit during sleep, soaking you and wrecking your rest.",
    whatItIs:
      "The nighttime version of a hot flash — intense sweating that can drench your pajamas and sheets, often waking you feeling overheated and disoriented, making it hard to fall back asleep.",
    whyItHappens:
      "Same mechanism as hot flashes (hypothalamus confusion from low estrogen), but occurring during sleep. The sudden heat disrupts REM cycles and prevents the deep, restorative sleep your body needs.",
    howLong:
      "Can persist throughout all of perimenopause and for years after menopause. Severity often fluctuates month to month and can worsen with stress.",
    whatHelps: [
      "Keep bedroom at 60–67°F — the most evidence-backed sleep intervention",
      "Moisture-wicking sheets and pajamas in bamboo or cotton",
      "A cooling mattress pad or topper",
      "Avoid alcohol and heavy meals within 2–3 hours of bedtime",
      "Keep ice water or a cold pack on your nightstand",
      "Hormone therapy — eliminates or greatly reduces night sweats in most women",
    ],
    whenToSeeDoctor:
      "If you're waking multiple times per night, if fatigue is seriously impacting your daily life, or if night sweats are accompanied by fever, unexplained weight loss, or illness.",
    didYouKnow:
      "Night sweats happen during sleep's lighter stages — which is why you almost always wake up mid-sweat rather than sleeping through them.",
  },
  {
    id: "brain-fog",
    icon: "🌫️",
    name: "Brain Fog",
    color: "#2980B9",
    summary: "Forgetting words mid-sentence, losing your train of thought, struggling to focus.",
    whatItIs:
      "A cluster of cognitive symptoms including trouble concentrating, short-term memory lapses, word-finding difficulties, mental fatigue, and a general feeling that your thinking is slower or less sharp than it used to be.",
    whyItHappens:
      "Estrogen actively supports brain function — it helps regulate neurotransmitters, blood flow to the brain, and nerve cell health. Fluctuating or declining estrogen directly impacts memory centers, especially the hippocampus. Poor sleep from night sweats makes it significantly worse.",
    howLong:
      "For most women, brain fog peaks in perimenopause and improves after menopause as hormone levels stabilize. Sleep deprivation dramatically amplifies cognitive symptoms.",
    whatHelps: [
      "Prioritize sleep above everything — it has the single biggest impact on cognition",
      "Regular aerobic exercise — a proven cognitive protector",
      "Brain-stimulating activities: reading, puzzles, learning new skills",
      "Stress management — cortisol directly impairs memory formation",
      "Stay hydrated — even mild dehydration affects concentration",
      "Hormone therapy — shown to help some women with cognitive symptoms",
    ],
    whenToSeeDoctor:
      "If memory issues are sudden, severe, rapidly progressive, or accompanied by personality changes — these warrant ruling out other causes beyond menopause.",
    didYouKnow:
      "Studies show verbal memory can temporarily decline during perimenopause — but for most women, it returns to baseline after menopause.",
  },
  {
    id: "mood-changes",
    icon: "🌊",
    name: "Mood Changes",
    color: "#E67E22",
    summary: "Irritability, anxiety, weepiness, or sudden low mood that can feel out of nowhere.",
    whatItIs:
      "Emotional swings that may feel foreign or out of proportion — sudden irritability, unexplained sadness, heightened anxiety, or a shorter fuse than usual. This is a genuine hormonal effect, not a personality problem or weakness.",
    whyItHappens:
      "Estrogen influences serotonin, dopamine, and GABA — the brain chemicals that regulate mood and emotional stability. As estrogen fluctuates wildly in perimenopause, so can your emotional regulation. Sleep deprivation from night sweats compounds this dramatically.",
    howLong:
      "Mood disruption is often worst during perimenopause when hormones are most erratic. Many women find emotional stability improves after menopause when hormone levels settle — though this varies widely.",
    whatHelps: [
      "Regular exercise — as effective as antidepressants for mild-to-moderate mood issues",
      "Consistent sleep — the most underrated mood stabilizer",
      "Therapy or CBT — especially effective for anxiety and irritability",
      "Social connection and talking openly about what you're experiencing",
      "5 minutes of daily mindfulness — shown to meaningfully reduce cortisol",
      "SSRIs, SNRIs, or hormone therapy — discuss with your doctor",
    ],
    whenToSeeDoctor:
      "If you experience persistent depression or hopelessness lasting more than two weeks, significant anxiety impacting daily life, or any thoughts of self-harm — seek help immediately.",
    didYouKnow:
      "Women who exercise regularly during perimenopause report significantly fewer mood-related symptoms than those who are sedentary.",
  },
  {
    id: "sleep-disruption",
    icon: "😴",
    name: "Sleep Disruption",
    color: "#16A085",
    summary: "Trouble falling asleep, staying asleep, or waking unrefreshed even after 8 hours.",
    whatItIs:
      "Difficulty falling asleep, frequent waking (often from night sweats), early morning waking, and waking up tired despite hours in bed. Sleep architecture itself changes during menopause — less time in deep, restorative slow-wave sleep.",
    whyItHappens:
      "Multiple overlapping causes: night sweats disrupting sleep cycles, declining progesterone (which has natural sleep-promoting properties), increased cortisol sensitivity, and changes to circadian rhythm. The domino effect on daytime mood, cognition, and energy is profound.",
    howLong:
      "Sleep disturbance is one of the most persistent menopause symptoms, often lasting well into post-menopause. Many women describe it as their most disruptive symptom.",
    whatHelps: [
      "Strict consistent sleep and wake times — the most powerful sleep intervention",
      "Bedroom at 60–67°F — cool temperature dramatically improves sleep continuity",
      "Limit alcohol — it disrupts sleep architecture even in small amounts",
      "Cut caffeine after noon",
      "CBT-I (Cognitive Behavioral Therapy for Insomnia) — highly effective, even more than sleep meds long-term",
      "Hormone therapy — directly addresses the root causes of sleep disruption",
    ],
    whenToSeeDoctor:
      "If you're consistently getting fewer than 5–6 hours per night, if fatigue is impairing your ability to drive safely, or if you suspect sleep apnea (which increases significantly after menopause).",
    didYouKnow:
      "Women are twice as likely as men to develop insomnia — and the menopause transition is a major contributing factor.",
  },
  {
    id: "joint-pain",
    icon: "🦴",
    name: "Joint Pain",
    color: "#C0392B",
    summary: "Aches, stiffness, and soreness — especially in the morning or after sitting.",
    whatItIs:
      "A general achiness, stiffness, or tenderness in the joints — commonly the knees, hips, hands, wrists, and shoulders. Many women are surprised to learn this is a menopause symptom, often assuming it's just aging.",
    whyItHappens:
      "Estrogen has powerful anti-inflammatory properties that protect joint cartilage. As levels decline, inflammation increases and cartilage becomes more vulnerable, leading to pain, swelling, and morning stiffness.",
    howLong:
      "Can develop during perimenopause and persist without intervention. Risk of worsening increases post-menopause as bone density also declines.",
    whatHelps: [
      "Low-impact exercise — swimming, cycling, and yoga strengthen muscles around joints without stress",
      "Anti-inflammatory diet — omega-3s, turmeric, leafy greens, berries",
      "Stay hydrated — cartilage is largely water",
      "Heat for stiffness, cold for inflammation and swelling",
      "Physical therapy — targeted exercises make a significant difference",
      "Maintain a healthy weight — each extra pound = 4 lbs of pressure on knee joints",
    ],
    whenToSeeDoctor:
      "If joints are swollen, red, or hot; if pain is severe or worsening; or if you have a family history of rheumatoid arthritis or lupus, which can first present or flare during menopause.",
    didYouKnow:
      "Up to 60% of women experience joint pain during the menopause transition — yet it remains one of the least-discussed symptoms.",
  },
  {
    id: "heart-palpitations",
    icon: "💓",
    name: "Heart Palpitations",
    color: "#E74C3C",
    summary: "A fluttering, pounding, or racing heart — often alarming, usually harmless.",
    whatItIs:
      "A noticeable awareness of your heartbeat — it may feel like it's racing, fluttering, skipping a beat, or pounding in your chest or throat. In most menopause cases it is benign, but it can be alarming when it happens.",
    whyItHappens:
      "Estrogen influences the heart's electrical system. As levels fluctuate, the heart's rhythm can become temporarily irregular. Hot flashes themselves also directly trigger an increase in heart rate.",
    howLong:
      "Usually brief — seconds to a few minutes per episode. Palpitations often correlate with hot flash frequency and tend to improve as hormones stabilize post-menopause.",
    whatHelps: [
      "Reduce caffeine and alcohol — both are common triggers",
      "Paced breathing during an episode — inhale 4 counts, exhale 6 counts",
      "Stay hydrated — dehydration can trigger irregular beats",
      "Magnesium-rich foods — almonds, spinach, pumpkin seeds, dark chocolate",
      "Stress reduction — cortisol spikes can trigger palpitations",
      "Track them against your hot flashes — the pattern often reveals the connection",
    ],
    whenToSeeDoctor:
      "Always mention new palpitations to your doctor. See one urgently if they last more than a few minutes, occur with chest pain, dizziness, or shortness of breath, or if you have any history of heart conditions.",
    didYouKnow:
      "Women's cardiovascular disease risk increases significantly after menopause — estrogen was providing meaningful heart protection. Post-menopause heart health becomes a priority.",
  },
  {
    id: "vaginal-dryness",
    icon: "🌺",
    name: "Vaginal Dryness",
    color: "#8E44AD",
    summary: "Dryness, irritation, and discomfort that can make intimacy painful.",
    whatItIs:
      "Thinning, drying, and inflammation of the vaginal walls — medically called GSM (Genitourinary Syndrome of Menopause). Symptoms include dryness, itching, burning, painful intercourse, and increased susceptibility to UTIs.",
    whyItHappens:
      "Estrogen keeps vaginal tissues elastic, moist, and healthy. As levels decline, the vaginal lining thins, loses its natural lubrication and acidity, and becomes more fragile and prone to irritation and infection.",
    howLong:
      "Unlike hot flashes (which often ease over time), vaginal dryness tends to worsen without treatment. It is one of the most progressive and — importantly — the most treatable menopause symptoms.",
    whatHelps: [
      "Over-the-counter vaginal moisturizers — use regularly (not just before sex) for best results",
      "Lubricants during intimacy — silicone-based last longer; water-based are condom-compatible",
      "Local vaginal estrogen cream or ring — highly effective, minimal systemic absorption, safe for most women",
      "Sexual activity itself — increases blood flow and helps maintain vaginal tissue health",
      "Stay hydrated — systemic hydration helps all mucous membranes",
      "Avoid scented soaps, douches, and synthetic underwear",
    ],
    whenToSeeDoctor:
      "If you have pain during sex, recurrent UTIs, urinary urgency or leakage, or discomfort affecting your quality of life. Local estrogen is safe for most women and is life-changing for many.",
    didYouKnow:
      "Unlike most menopause symptoms, vaginal dryness does not resolve on its own over time — but it is one of the most successfully treated symptoms in menopause care.",
  },
  {
    id: "weight-changes",
    icon: "⚖️",
    name: "Weight Changes",
    color: "#F39C12",
    summary: "Gaining belly fat even without changing what you eat.",
    whatItIs:
      "A redistribution of body fat — particularly accumulating around the abdomen — even without any change in diet or exercise. Losing weight also becomes harder during this transition.",
    whyItHappens:
      "Declining estrogen shifts fat storage from hips and thighs to the abdomen. Metabolism slows as muscle mass decreases (muscle burns more calories at rest). Cortisol and poor sleep further promote belly fat storage.",
    howLong:
      "This metabolic shift is ongoing post-menopause. Without sustained lifestyle changes, abdominal fat tends to accumulate gradually over years.",
    whatHelps: [
      "Strength training — the single most important tool for preserving metabolism",
      "Adequate protein at every meal — protects muscle mass while managing weight",
      "Prioritize sleep — deprivation directly increases cortisol and fat-storage hormones",
      "Limit ultra-processed foods and refined sugars",
      "Manage stress — chronic cortisol is a powerful belly fat trigger",
      "30+ minutes of cardio most days — shown to offset most menopause-related weight gain",
    ],
    whenToSeeDoctor:
      "If weight gain is rapid and unexplained, or if you have concerns about blood pressure, cholesterol, or blood sugar — all of which are affected by abdominal fat accumulation.",
    didYouKnow:
      "The average woman gains 2–5 pounds in the year of menopause — but regular strength training can almost entirely offset this.",
  },
  {
    id: "hair-changes",
    icon: "💇",
    name: "Hair Changes",
    color: "#1ABC9C",
    summary: "Thinning hair on your scalp, or coarser texture and changes in growth.",
    whatItIs:
      "Scalp hair thinning (often at the temples and crown), slower hair growth, changes in texture (coarser or finer), and sometimes increased facial or chin hair growth.",
    whyItHappens:
      "Estrogen prolongs the hair growth phase. As it declines, the growth phase shortens and more hairs enter the shedding phase simultaneously. Simultaneously, testosterone becomes relatively more dominant — it can thin scalp hair while stimulating chin or facial hair.",
    howLong:
      "Hair changes tend to be gradual and progressive without intervention. Some women see improvement as hormones stabilize post-menopause; for others, changes persist and evolve.",
    whatHelps: [
      "Daily scalp massage — shown to improve follicle stimulation and thickness",
      "Biotin-rich foods — eggs, salmon, nuts, seeds",
      "Avoid harsh heat styling and tight hairstyles that stress follicles",
      "Minoxidil (over-the-counter) — proven effective for female pattern hair thinning",
      "Low-level laser therapy — FDA-cleared and increasingly well-studied",
      "Hormone therapy — can help some women retain hair density",
    ],
    whenToSeeDoctor:
      "If hair loss is sudden, patchy, or significant — it may indicate thyroid issues, iron deficiency, or other conditions common in this life stage that are treatable and distinct from menopause.",
    didYouKnow:
      "Studies suggest up to 50% of women experience noticeable hair thinning by age 50 — yet it remains rarely discussed in medical appointments.",
  },
  {
    id: "skin-changes",
    icon: "✨",
    name: "Skin Changes",
    color: "#E91E8C",
    summary: "Drier, thinner skin that may lose firmness and develop more lines.",
    whatItIs:
      "The skin becomes drier, thinner, and less elastic. You may notice increased dryness, fine lines developing more quickly, slower wound healing, increased sensitivity, adult acne flares, and changes in overall texture and radiance.",
    whyItHappens:
      "Estrogen stimulates collagen production — the protein that keeps skin firm and plump. As levels fall, collagen production drops significantly (studies show up to 30% loss in the first 5 years post-menopause). Sebaceous glands also produce less oil, causing dryness.",
    howLong:
      "Skin changes are progressive without intervention. Collagen loss is most rapid in the first 5–10 years post-menopause, making this window a key time to build protective habits.",
    whatHelps: [
      "SPF 30+ daily — the #1 evidence-backed anti-aging and collagen-protecting intervention",
      "Hyaluronic acid moisturizer — draws and holds moisture in thinning skin",
      "Retinoids (vitamin A) — proven to stimulate collagen and improve texture",
      "Stay hydrated — skin is your body's largest organ and needs systemic water",
      "Antioxidant-rich diet — vitamin C (direct collagen support), vitamin E, polyphenols",
      "Hormone therapy — shown in studies to improve skin collagen content and moisture retention",
    ],
    whenToSeeDoctor:
      "If you notice new or changing moles, severe adult acne, or unusual skin reactions. A yearly skin check is increasingly important post-menopause.",
    didYouKnow:
      "Women can lose up to 30% of their skin's collagen in the first five years after menopause — making daily sunscreen one of the most powerful protective investments.",
  },
];

interface Myth {
  myth: string;
  truth: string;
}

const MYTHS: Myth[] = [
  {
    myth: "Menopause starts at 50.",
    truth: "It can start in your 30s. Perimenopause — the transition phase — typically begins in the mid-40s, but early menopause before 45 affects about 5% of women, and premature menopause before 40 affects about 1%.",
  },
  {
    myth: "Hot flashes only last a few months.",
    truth: "They can last 10+ years. The average woman experiences hot flashes for 7–10 years, and research shows up to 1 in 3 women continues having them for more than a decade after menopause.",
  },
  {
    myth: "Menopause means your sex life is over.",
    truth: "Many women report better intimacy after menopause. Without fear of pregnancy and with greater self-knowledge, many women experience deeper connection and more confidence. Symptoms like vaginal dryness are highly treatable.",
  },
  {
    myth: "Weight gain is inevitable.",
    truth: "Lifestyle changes make a significant difference. While hormonal shifts do change where fat is stored, regular strength training, adequate protein, and sleep management can offset the majority of menopause-related weight changes.",
  },
  {
    myth: "It is all in your head.",
    truth: "Every symptom is physiologically real and valid. Hot flashes, brain fog, mood shifts, joint pain — all have measurable, documented biological mechanisms rooted in hormonal changes affecting every system in your body.",
  },
  {
    myth: "HRT is dangerous for everyone.",
    truth: "It depends entirely on individual health history. For most healthy women under 60 or within 10 years of menopause, hormone therapy's benefits outweigh the risks. Your doctor can assess what is right specifically for you.",
  },
];

interface PartnerSubsection {
  id: string;
  icon: string;
  title: string;
  color: string;
  items: string[];
  type: "do" | "dont" | "neutral";
}

const PARTNER_SUBSECTIONS: PartnerSubsection[] = [
  {
    id: "support",
    icon: "🤝",
    title: "How to Support Her",
    color: "#E91E8C",
    type: "do",
    items: [
      "Listen first — don't rush to fix. She may just need to be heard.",
      "Believe her symptoms without minimizing or comparing them to others.",
      "Learn the basics — understanding what's happening gives you the words to show up.",
      "Ask 'what do you need right now?' instead of assuming you know.",
      "Keep the bedroom cool without making it a recurring negotiation.",
      "Celebrate her tracking habit — logging every flash takes real commitment.",
      "Offer to attend a doctor's appointment with her if she'd like the support.",
      "Give her grace on high-flash days — her body is working harder than you can see.",
    ],
  },
  {
    id: "dont-say",
    icon: "🚫",
    title: "What Not to Say",
    color: "#E74C3C",
    type: "dont",
    items: [
      "\"Is this the menopause again?\" — it invalidates everything she's feeling.",
      "\"You just need to calm down.\" — her nervous system is genuinely dysregulated.",
      "\"It can't be that bad.\" — it is. Believe her.",
      "\"At least you're done with periods.\" — tone-deaf and not the point.",
      "\"You've changed so much.\" — she knows, and it's frightening for her too.",
      "\"My mom went through this and she was totally fine.\" — everyone's experience is different.",
      "Silence. Ignoring what she's going through is its own kind of answer.",
    ],
  },
  {
    id: "helps",
    icon: "💚",
    title: "What Actually Helps",
    color: "#27AE60",
    type: "do",
    items: [
      "\"I did some reading about what you're going through.\" — showing effort means everything.",
      "\"How can I make tonight more comfortable for you?\" — specific and actionable.",
      "\"Take as much time as you need — I've got this.\" — removes the pressure.",
      "Keep a cold drink on her nightstand without being asked.",
      "Handle dinner or the kids on high-flash days without waiting to be told.",
      "Check in with a simple 'How are you feeling today?' — and mean it.",
      "Reduce noise and stimulation during a flash — quiet is healing.",
      "Tell her she is strong. Then tell her again.",
    ],
  },
  {
    id: "flashyaf-together",
    icon: "🔥",
    title: "Using FLASHYAF™ Together",
    color: "#FF4500",
    type: "neutral",
    items: [
      "Review her weekly flash data together — patterns tell a story she may not have words for.",
      "Notice her high-flash days and plan low-demand activities on those days.",
      "Enable Partner Mode in Settings — you'll get email alerts when a flash ends.",
      "Use her data to time harder conversations — avoid them during peak symptom windows.",
      "Celebrate her tracking milestones — every 25 flashes logged is real effort.",
      "Her data is her superpower. Help protect the habit of collecting it.",
      "The Education Hub is for both of you. Read it together and talk about what you learn.",
    ],
  },
];

interface WorkplaceTipGroup {
  id: string;
  icon: string;
  title: string;
  items: string[];
}

const WORKPLACE_STATS = [
  { stat: "1 in 3", label: "working women is currently in perimenopause or menopause" },
  { stat: "10%", label: "of women leave the workforce due to unmanaged menopause symptoms" },
  { stat: "73%", label: "of women say symptoms have impacted their work performance" },
  { stat: "$1.8B", label: "lost annually in US productivity due to menopause-related absenteeism" },
  { stat: "5%", label: "of employers have any formal menopause workplace policy in place" },
];

const WORKPLACE_TIP_GROUPS: WorkplaceTipGroup[] = [
  {
    id: "rights",
    icon: "⚖️",
    title: "Know Your Rights",
    items: [
      "The ADA (Americans with Disabilities Act) may require your employer to provide reasonable accommodations if severe symptoms impair a major life activity.",
      "Title VII of the Civil Rights Act protects against sex-based discrimination — adverse treatment due to menopause can fall under this protection.",
      "FMLA (Family and Medical Leave Act) may cover menopause-related medical appointments and serious symptom flares.",
      "Many states have additional protections beyond federal law — consult a local employment attorney for specifics.",
      "You are not required to disclose your diagnosis. You only need to describe functional limitations, not the underlying condition.",
      "Retaliation for requesting accommodations is illegal. Document all communication in writing.",
    ],
  },
  {
    id: "talking",
    icon: "🗣️",
    title: "How to Talk to Your Employer",
    items: [
      "Request a private meeting with HR or your direct manager — never disclose in a group setting.",
      "Frame requests around your needs and solutions, not your diagnosis: 'I need a cooler workspace' rather than 'I have menopause.'",
      "Put all requests in writing after any verbal conversation — email creates an essential paper trail.",
      "Know your company's leave and accommodation policies before the meeting so you speak their language.",
      "Bring a doctor's note or functional assessment if you anticipate pushback — documentation strengthens your case.",
      "Focus on the business case: 'These adjustments will allow me to perform at my best consistently.'",
      "If your manager is dismissive, escalate to HR in writing and reference relevant employment law.",
    ],
  },
  {
    id: "managing",
    icon: "🧊",
    title: "Managing Symptoms at Work",
    items: [
      "Keep a small personal fan, cold water, and a cooling mist spray at your workstation.",
      "Dress in moisture-wicking, breathable layers you can adjust quickly during a flash.",
      "Use your FLASHYAF™ data to identify your lowest-symptom windows — schedule high-stakes meetings then.",
      "Take short breaks to step outside or splash cold water on your face during acute flashes.",
      "Locate the nearest private restroom or quiet space to use as a reset point on difficult days.",
      "Talk to trusted colleagues if you may need to step away — brief honesty reduces anxiety.",
      "Discuss symptom timing with your doctor to explore whether treatments can be timed around your work schedule.",
      "Request a workspace near a window or exterior wall where you can control airflow.",
    ],
  },
];

const LETTER_TEMPLATE = `[DATE]

[Your Name]
[Your Job Title / Department]
[Company Name]

To: [Manager / HR Representative Name]
Re: Request for Reasonable Workplace Accommodations

Dear [Name],

I am writing to formally request reasonable workplace accommodations related to a medical health condition I am currently managing. As a committed member of the [Department] team, I want to ensure I can continue contributing at the level you have come to expect.

I am navigating symptoms associated with perimenopause/menopause — a natural health transition affecting millions of working women. Symptoms I experience at work include [brief factual description, e.g., temperature dysregulation, disrupted sleep affecting concentration, and fatigue]. My healthcare provider has advised that certain environmental and scheduling adjustments can significantly reduce their impact on my daily performance.

The accommodations I am requesting include:

  ☐  Access to a personal fan or assignment to a workspace with better temperature regulation
  ☐  Flexible break times to step away and manage acute symptoms privately
  ☐  Permission to keep cold water and a cooling spray at my workstation
  ☐  Flexible start or end times on high-symptom days (when operationally feasible)
  ☐  Option to work remotely on severe symptom days (when role allows)
  ☐  [Add any additional specific accommodation you need]

These requests are low-cost, non-disruptive to team operations, and will allow me to maintain the consistent, high-quality performance you depend on. I am happy to provide supporting documentation from my healthcare provider and am open to discussing alternatives that meet both my medical needs and the team's operational requirements.

I would welcome the opportunity to discuss this at your earliest convenience.

Sincerely,

[Your Name]
[Date]
[Email / Phone]

---
This letter was generated by FLASHYAF™ — the menopause tracking app for women who refuse to disappear.
Track your data. Know your patterns. Own your health.
`;

const SECTIONS: Section[] = [
  {
    id: "body",
    icon: "🌸",
    title: "What Is Happening To My Body",
    color: "#8E44AD",
    bg: "rgba(142,68,173,0.08)",
    border: "rgba(142,68,173,0.3)",
    intro: "Your body is going through one of the most significant hormonal transitions of your life — and it is completely normal.",
    bullets: [
      "Perimenopause typically starts in your mid-40s (average age 47) and can last 4–10 years before menopause",
      "During perimenopause, estrogen and progesterone fluctuate unpredictably — this causes most symptoms",
      "Menopause is officially defined as 12 consecutive months without a period — average age in the US is 51",
      "Post-menopause begins after that 12-month mark — symptoms often ease, but bone and heart health become priorities",
      "The hypothalamus (your brain's thermostat) is highly sensitive to estrogen — when levels drop, it gets confused",
      "Common symptoms: hot flashes, night sweats, sleep disruption, mood changes, brain fog, joint aches, vaginal dryness",
      "Every woman's experience is unique — some have minimal symptoms, others have significant ones for years",
      "This is not a disease. It's a natural biological transition that every woman who lives long enough will experience",
    ],
  },
  {
    id: "science",
    icon: "🔬",
    title: "Hot Flash Science",
    color: "#C0392B",
    bg: "rgba(192,57,43,0.08)",
    border: "rgba(192,57,43,0.3)",
    intro: "Hot flashes are the most common menopause symptom — and science actually understands exactly why they happen.",
    bullets: [
      "Your hypothalamus acts as your body's thermostat, normally allowing a temperature variation of 0.4°C before triggering cooling",
      "Declining estrogen narrows this 'thermoneutral zone' — even tiny temperature increases trigger your body's full cooling response",
      "That cooling response includes sweating, skin flushing, and a rapid heart rate — your body genuinely thinks it's overheating",
      "Common triggers: alcohol, caffeine, spicy foods, stress, heat, tight clothing, smoking — varies from person to person",
      "Average hot flash duration: 1–5 minutes, though some can last up to 30 minutes",
      "Night sweats are exactly the same mechanism — just happening during sleep, disrupting REM cycles and causing exhaustion",
      "About 75% of women experience hot flashes. Some have 1 per day; others experience 20+ at peak perimenopause",
      "Most women have hot flashes for 7–10 years — not just a few months as was commonly believed",
      "Research-backed management: hormone therapy (most effective), paced breathing (reduces frequency up to 50%), CBT, certain SSRIs",
    ],
  },
  {
    id: "relief",
    icon: "🌿",
    title: "Natural Relief Strategies",
    color: "#16A085",
    bg: "rgba(22,160,133,0.08)",
    border: "rgba(22,160,133,0.3)",
    intro: "There is a lot you can do right now — no prescription required. Small changes compound into meaningful relief.",
    bullets: [
      "Cooling: Keep a handheld fan nearby — immediate airflow is the fastest flash de-escalator you have",
      "Cooling: Cold water on your wrists and the back of your neck works instantly — pulse points cool your whole body",
      "Cooling: A cooling mattress pad or moisture-wicking sheets can transform your sleep quality",
      "Diet: Reduce alcohol, caffeine, and spicy foods — the top three dietary triggers for most women",
      "Diet: Increase phytoestrogens — soy milk, edamame, tofu, flaxseed — they have mild estrogen-like effects",
      "Exercise: 30 minutes of cardio has been shown to reduce hot flash frequency by up to 55%",
      "Exercise: Yoga and tai chi are especially well-studied for reducing the overall menopause symptom burden",
      "Stress: Even 5 minutes of mindfulness daily lowers cortisol, which is a significant flash trigger",
      "Sleep: Keep your bedroom at 60–67°F — this is the most evidence-backed intervention for night sweats",
      "Clothing: Natural fabrics (cotton, bamboo, linen) breathe better — avoid synthetics that trap heat",
      "Tracking: Use your FLASHYAF data to identify your personal triggers — patterns give you control",
    ],
  },
  {
    id: "doctor",
    icon: "🩺",
    title: "When To See A Doctor",
    color: "#2980B9",
    bg: "rgba(41,128,185,0.08)",
    border: "rgba(41,128,185,0.3)",
    intro: "Your doctor is your partner in this — and your tracking data makes you a powerful, informed patient.",
    bullets: [
      "See a doctor if hot flashes are severely impacting your sleep, work, or quality of life",
      "See a doctor if you experience flashes with chest pain, heart palpitations, or shortness of breath",
      "See a doctor if you're experiencing significant depression, anxiety, or thoughts of self-harm",
      "See a doctor if sudden or significant cognitive issues or memory problems develop",
      "Questions to ask: 'What are my HRT options?' 'What non-hormonal treatments exist for me?' 'How do I protect my bones and heart?'",
      "HRT (Hormone Replacement Therapy): the most effective treatment — reduces hot flashes by 70–80%. Risk varies by individual history",
      "Non-hormonal options: SSRIs/SNRIs, gabapentin, fezolinetant (FDA-approved 2023), cognitive behavioral therapy",
      "Using your FLASHYAF data: print your monthly report before appointments — show frequency, duration, intensity, and time patterns",
      "A good doctor welcomes your data. You deserve a doctor who takes your symptoms seriously",
    ],
  },
  {
    id: "alone",
    icon: "💜",
    title: "You Are Not Alone",
    color: "#E67E22",
    bg: "rgba(230,126,34,0.08)",
    border: "rgba(230,126,34,0.3)",
    intro: "You are part of a global community of women navigating this same transition — including some of the world's most admired people.",
    bullets: [
      "Approximately 1.3 billion women worldwide are expected to be in menopause or post-menopause by 2025",
      "75% of women in perimenopause and menopause experience hot flashes — you are in the vast majority",
      "The average woman experiences menopause symptoms for 7–10 years — not days or months",
      "Michelle Obama wrote candidly about her hot flashes in her memoir, including having one on a government helicopter",
      "Oprah Winfrey has called menopause 'a powerful time' and openly discussed how treatment changed her life",
      "Naomi Watts founded a menopause wellness company after experiencing early menopause at 36",
      "Gwyneth Paltrow, Halle Berry, and many others have spoken openly about perimenopause in recent years",
      "A growing global movement is breaking the silence around menopause in workplaces, media, and medicine",
      "Your experience — and your data — matters. Every flash you track contributes to understanding that helps all women",
      "You are not declining. You are transforming. You are not alone. 💜",
    ],
  },
];

const SYMPTOM_FIELDS = [
  { key: "whatItIs",        label: "What It Is",          icon: "📖" },
  { key: "whyItHappens",   label: "Why It Happens",       icon: "🔬" },
  { key: "howLong",        label: "How Long It Lasts",    icon: "⏱️" },
  { key: "whenToSeeDoctor",label: "When To See A Doctor", icon: "🩺" },
  { key: "didYouKnow",     label: "Did You Know",         icon: "💡" },
] as const;

export default function LearnScreen({ onNavigate }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["body"]));
  const [openSymptoms, setOpenSymptoms] = useState<Set<string>>(new Set());
  const [symptomsExpanded, setSymptomsExpanded] = useState(false);
  const [mythsExpanded, setMythsExpanded] = useState(false);
  const [partnerGuideExpanded, setPartnerGuideExpanded] = useState(false);
  const [openPartnerSubs, setOpenPartnerSubs] = useState<Set<string>>(new Set());
  const [pcName, setPcName] = useState("");
  const [pcMessage, setPcMessage] = useState("");
  const [pcSending, setPcSending] = useState(false);
  const [pcSent, setPcSent] = useState(false);
  const [pcError, setPcError] = useState("");
  const [workplaceExpanded, setWorkplaceExpanded] = useState(false);
  const [openWorkplaceSubs, setOpenWorkplaceSubs] = useState<Set<string>>(new Set());
  const [statsExpanded, setStatsExpanded] = useState(false);

  useEffect(() => { trackEvent("education_hub_opened"); }, []);

  function togglePartnerSub(id: string) {
    setOpenPartnerSubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handlePartnerCheckin() {
    if (!user) return;
    const name = pcName.trim();
    const message = pcMessage.trim();
    if (!name) { setPcError("Please enter your name."); return; }
    if (!message) { setPcError("Please write a message."); return; }
    setPcSending(true); setPcError("");
    try {
      await addDoc(collection(db, "partnerMessages"), {
        userId: user.uid,
        name,
        message,
        timestamp: serverTimestamp(),
        read: false,
      });
      setPcSent(true);
      setPcName(""); setPcMessage("");
    } catch {
      setPcError("Couldn't send. Please try again.");
    }
    setPcSending(false);
  }

  function toggleWorkplaceSub(id: string) {
    setOpenWorkplaceSubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function downloadLetterTemplate() {
    const blob = new Blob([LETTER_TEMPLATE], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "FLASHYAF_Workplace_Accommodations_Letter.txt";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    trackEvent("workplace_letter_downloaded");
  }

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSymptom(id: string) {
    setOpenSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const q = searchQuery.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      s.intro.toLowerCase().includes(q) ||
      s.bullets.some((b) => b.toLowerCase().includes(q))
    );
  }, [q]);

  const filteredSymptoms = useMemo(() => {
    if (!q) return SYMPTOMS;
    return SYMPTOMS.filter((sym) =>
      sym.name.toLowerCase().includes(q) ||
      sym.summary.toLowerCase().includes(q) ||
      sym.whatItIs.toLowerCase().includes(q) ||
      sym.whyItHappens.toLowerCase().includes(q) ||
      sym.howLong.toLowerCase().includes(q) ||
      sym.whatHelps.some((h) => h.toLowerCase().includes(q)) ||
      sym.whenToSeeDoctor.toLowerCase().includes(q) ||
      sym.didYouKnow.toLowerCase().includes(q)
    );
  }, [q]);

  const showSymptomsSection = filteredSymptoms.length > 0;
  const totalResults = filteredSections.length + (showSymptomsSection ? filteredSymptoms.length : 0);

  const highlightText = (text: string): React.ReactNode => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: "rgba(245,166,35,0.4)", color: "inherit", borderRadius: "2px", padding: "0 1px" }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <p style={s.appName}>FLASHYAF™</p>
        <p style={s.headerTitle}>Education Hub</p>
        <p style={s.headerSub}>Know your body. Own your power.</p>
      </div>

      {/* Search */}
      <div style={s.searchWrap}>
        <span style={s.searchIcon}>🔍</span>
        <input
          style={s.searchInput}
          type="text"
          placeholder="Search topics, symptoms, strategies…"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim()) {
              setOpenSections(new Set(SECTIONS.map((s) => s.id)));
              setOpenSymptoms(new Set(SYMPTOMS.map((s) => s.id)));
              setSymptomsExpanded(true);
            }
          }}
        />
        {searchQuery && (
          <button style={s.searchClear} onClick={() => setSearchQuery("")}>✕</button>
        )}
      </div>

      {/* Content */}
      <div style={s.scroll}>
        {totalResults === 0 && (
          <div style={s.emptySearch}>
            <p style={s.emptySearchIcon}>🔍</p>
            <p style={s.emptySearchText}>No results for "{searchQuery}"</p>
            <button style={s.emptySearchClear} onClick={() => setSearchQuery("")}>Clear search</button>
          </div>
        )}

        {/* ── Know Your Symptoms ─────────────────────────────────── */}
        {showSymptomsSection && (
          <div style={s.symptomSection}>
            {/* Section header */}
            <button style={s.symptomSectionHeader} onClick={() => setSymptomsExpanded((v) => !v)}>
              <div style={s.symptomSectionIconCircle}>
                <span style={{ fontSize: "22px" }}>🩻</span>
              </div>
              <div style={s.sectionTitleWrap}>
                <p style={{ ...s.sectionTitle, color: "#FF6B9D" }}>Know Your Symptoms</p>
                {!symptomsExpanded && (
                  <p style={s.sectionPreview}>{SYMPTOMS.length} symptoms explained</p>
                )}
              </div>
              <span style={{ ...s.chevron, transform: symptomsExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
            </button>

            {symptomsExpanded && (
              <div style={s.symptomCardsWrap}>
                {filteredSymptoms.map((sym) => {
                  const isOpen = openSymptoms.has(sym.id);
                  return (
                    <div key={sym.id} style={s.symptomCard}>
                      {/* Symptom card header */}
                      <button style={s.symptomCardHeader} onClick={() => toggleSymptom(sym.id)}>
                        <div style={{ ...s.symptomDot, background: sym.color + "22", border: `1px solid ${sym.color}44` }}>
                          <span style={{ fontSize: "18px", lineHeight: 1 }}>{sym.icon}</span>
                        </div>
                        <div style={s.symptomCardMeta}>
                          <p style={{ ...s.symptomName, color: sym.color }}>{highlightText(sym.name)}</p>
                          <p style={s.symptomSummary}>{highlightText(sym.summary)}</p>
                        </div>
                        <span style={{ ...s.chevron, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>▾</span>
                      </button>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div style={s.symptomDetail}>
                          {/* Text fields */}
                          {SYMPTOM_FIELDS.map(({ key, label, icon }) => (
                            <div key={key} style={s.fieldBlock}>
                              <div style={s.fieldHeader}>
                                <span style={s.fieldIcon}>{icon}</span>
                                <p style={{ ...s.fieldLabel, color: sym.color }}>{label}</p>
                              </div>
                              <p style={s.fieldText}>{highlightText(sym[key])}</p>
                            </div>
                          ))}

                          {/* What Helps list */}
                          <div style={s.fieldBlock}>
                            <div style={s.fieldHeader}>
                              <span style={s.fieldIcon}>🌿</span>
                              <p style={{ ...s.fieldLabel, color: sym.color }}>What Helps</p>
                            </div>
                            <div style={s.helpList}>
                              {sym.whatHelps.map((tip, i) => (
                                <div key={i} style={s.helpRow}>
                                  <div style={{ ...s.helpDot, background: sym.color }} />
                                  <p style={s.helpText}>{highlightText(tip)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Menopause Myth Busters ─────────────────────────────── */}
        {(!q || MYTHS.some((m) => m.myth.toLowerCase().includes(q) || m.truth.toLowerCase().includes(q))) && (
          <div style={s.mythSection}>
            <button style={s.mythSectionHeader} onClick={() => setMythsExpanded((v) => !v)}>
              <div style={s.mythIconCircle}>
                <span style={{ fontSize: "22px" }}>💥</span>
              </div>
              <div style={s.sectionTitleWrap}>
                <p style={{ ...s.sectionTitle, color: "#FF4500" }}>Menopause Myth Busters</p>
                {!mythsExpanded && (
                  <p style={s.sectionPreview}>{MYTHS.length} common myths debunked</p>
                )}
              </div>
              <span style={{ ...s.chevron, transform: mythsExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
            </button>

            {mythsExpanded && (
              <div style={s.mythCardsWrap}>
                {MYTHS.filter((m) =>
                  !q || m.myth.toLowerCase().includes(q) || m.truth.toLowerCase().includes(q)
                ).map((m, i) => (
                  <div key={i} style={s.mythCard}>
                    <div style={s.mythBlock}>
                      <span style={s.mythLabel}>MYTH</span>
                      <p style={s.mythText}>{highlightText(m.myth)}</p>
                    </div>
                    <div style={s.truthDivider} />
                    <div style={s.truthBlock}>
                      <span style={s.truthLabel}>TRUTH</span>
                      <p style={s.truthText}>{highlightText(m.truth)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Partner & Caregiver Guide ──────────────────────────── */}
        {(!q || PARTNER_SUBSECTIONS.some((ps) => ps.title.toLowerCase().includes(q) || ps.items.some((i) => i.toLowerCase().includes(q)))) && (
          <div style={s.partnerSection}>
            <button style={s.partnerSectionHeader} onClick={() => setPartnerGuideExpanded((v) => !v)}>
              <div style={s.partnerIconCircle}>
                <span style={{ fontSize: "22px" }}>💜</span>
              </div>
              <div style={s.sectionTitleWrap}>
                <p style={{ ...s.sectionTitle, color: "#E91E8C" }}>Partner & Caregiver Guide</p>
                {!partnerGuideExpanded && (
                  <p style={s.sectionPreview}>How to show up for someone you love</p>
                )}
              </div>
              <span style={{ ...s.chevron, transform: partnerGuideExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
            </button>

            {partnerGuideExpanded && (
              <div style={s.partnerContent}>
                <p style={s.partnerIntro}>
                  Menopause is not just her journey — it's yours too. This guide gives you the words,
                  the actions, and the understanding to be the partner she needs right now.
                </p>

                {/* Subsections */}
                {PARTNER_SUBSECTIONS.filter((ps) =>
                  !q || ps.title.toLowerCase().includes(q) || ps.items.some((i) => i.toLowerCase().includes(q))
                ).map((sub) => {
                  const isOpen = openPartnerSubs.has(sub.id);
                  const dotColor = sub.type === "dont" ? "#E74C3C" : sub.type === "do" ? sub.color : sub.color;
                  return (
                    <div key={sub.id} style={{
                      ...s.partnerSubCard,
                      border: `1px solid ${sub.color}30`,
                      background: `${sub.color}08`,
                    }}>
                      <button style={s.partnerSubHeader} onClick={() => togglePartnerSub(sub.id)}>
                        <div style={{ ...s.partnerSubIconCircle, background: `${sub.color}18` }}>
                          <span style={{ fontSize: "18px", lineHeight: 1 }}>{sub.icon}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ ...s.partnerSubTitle, color: sub.color }}>{sub.title}</p>
                          {!isOpen && <p style={s.partnerSubPreview}>{sub.items.length} points</p>}
                        </div>
                        <span style={{ ...s.chevron, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", fontSize: "16px" }}>▾</span>
                      </button>
                      {isOpen && (
                        <div style={s.partnerSubItems}>
                          {sub.items.filter((item) => !q || item.toLowerCase().includes(q)).map((item, i) => (
                            <div key={i} style={s.partnerSubItem}>
                              <div style={{ ...s.partnerItemDot, background: dotColor }} />
                              <p style={s.partnerItemText}>{highlightText(item)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Partner Check-In */}
                <div style={s.checkinCard}>
                  <div style={s.checkinHeader}>
                    <span style={{ fontSize: "24px" }}>💌</span>
                    <div>
                      <p style={s.checkinTitle}>Send a Check-In Message</p>
                      <p style={s.checkinSub}>Leave an encouraging note — she'll see it when she opens FLASHYAF™.</p>
                    </div>
                  </div>

                  {pcSent ? (
                    <div style={s.checkinSuccess}>
                      <span style={{ fontSize: "32px" }}>💜</span>
                      <p style={s.checkinSuccessTitle}>Message sent with love.</p>
                      <p style={s.checkinSuccessSub}>She'll see it the next time she opens the app.</p>
                      <button style={s.checkinSendAgainBtn} onClick={() => setPcSent(false)}>
                        Send another →
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <input
                        style={s.checkinInput}
                        type="text"
                        placeholder="Your name (e.g. Michael, Mom, Alex)"
                        value={pcName}
                        onChange={(e) => { setPcName(e.target.value); setPcError(""); }}
                      />
                      <textarea
                        style={{ ...s.checkinInput, height: "88px", resize: "none", lineHeight: 1.55, paddingTop: "12px" } as React.CSSProperties}
                        placeholder="e.g. I see how hard this is. I'm proud of you every single day. 💜"
                        value={pcMessage}
                        onChange={(e) => { setPcMessage(e.target.value); setPcError(""); }}
                        maxLength={280}
                      />
                      {pcMessage.length > 0 && (
                        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "11px", margin: 0, textAlign: "right" as const }}>
                          {pcMessage.length}/280
                        </p>
                      )}
                      {pcError && <p style={{ color: "#FF6B6B", fontSize: "12px", fontWeight: 600, margin: 0 }}>{pcError}</p>}
                      {!user && (
                        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", margin: 0 }}>
                          She needs to be logged in to FLASHYAF™ for this to reach her.
                        </p>
                      )}
                      <button
                        style={{
                          ...s.checkinSendBtn,
                          opacity: pcSending || !user ? 0.6 : 1,
                          cursor: pcSending || !user ? "not-allowed" : "pointer",
                        }}
                        onClick={handlePartnerCheckin}
                        disabled={pcSending || !user}
                      >
                        {pcSending ? "Sending…" : "Send with Love 💜"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Workplace Support ──────────────────────────────────── */}
        {(!q || WORKPLACE_TIP_GROUPS.some((g) => g.title.toLowerCase().includes(q) || g.items.some((i) => i.toLowerCase().includes(q))) || WORKPLACE_STATS.some((ws) => ws.label.toLowerCase().includes(q))) && (
          <div style={s.workplaceSection}>
            <button style={s.workplaceSectionHeader} onClick={() => setWorkplaceExpanded((v) => !v)}>
              <div style={s.workplaceIconCircle}>
                <span style={{ fontSize: "22px" }}>💼</span>
              </div>
              <div style={s.sectionTitleWrap}>
                <p style={{ ...s.sectionTitle, color: "#2980B9" }}>Workplace Support</p>
                {!workplaceExpanded && (
                  <p style={s.sectionPreview}>Rights, tips & a letter template for accommodations</p>
                )}
              </div>
              <span style={{ ...s.chevron, transform: workplaceExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
            </button>

            {workplaceExpanded && (
              <div style={s.workplaceContent}>
                <p style={s.workplaceIntro}>
                  Menopause costs women careers, promotions, and confidence at work every day — not because
                  of their symptoms, but because no one talks about it. This changes now.
                </p>

                {/* ── Stats ── */}
                {(!q || WORKPLACE_STATS.some((ws) => ws.label.toLowerCase().includes(q))) && (
                  <div style={s.statsSection}>
                    <button style={s.statsSectionHeader} onClick={() => setStatsExpanded((v) => !v)}>
                      <span style={{ fontSize: "16px" }}>📊</span>
                      <p style={s.statsSectionTitle}>Menopause & Workplace: The Numbers</p>
                      <span style={{ ...s.chevron, transform: statsExpanded ? "rotate(180deg)" : "rotate(0deg)", fontSize: "14px", marginLeft: "auto" }}>▾</span>
                    </button>
                    {statsExpanded && (
                      <div style={s.statsGrid}>
                        {WORKPLACE_STATS.map((ws, i) => (
                          <div key={i} style={s.statCard}>
                            <p style={s.statNumber}>{ws.stat}</p>
                            <p style={s.statLabel}>{ws.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tip Groups ── */}
                {WORKPLACE_TIP_GROUPS.filter((g) =>
                  !q || g.title.toLowerCase().includes(q) || g.items.some((i) => i.toLowerCase().includes(q))
                ).map((group) => {
                  const isOpen = openWorkplaceSubs.has(group.id);
                  return (
                    <div key={group.id} style={s.workplaceSubCard}>
                      <button style={s.workplaceSubHeader} onClick={() => toggleWorkplaceSub(group.id)}>
                        <div style={s.workplaceSubIconCircle}>
                          <span style={{ fontSize: "18px", lineHeight: 1 }}>{group.icon}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={s.workplaceSubTitle}>{group.title}</p>
                          {!isOpen && <p style={s.workplaceSubPreview}>{group.items.length} points</p>}
                        </div>
                        <span style={{ ...s.chevron, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", fontSize: "16px" }}>▾</span>
                      </button>
                      {isOpen && (
                        <div style={s.workplaceSubItems}>
                          {group.items.filter((item) => !q || item.toLowerCase().includes(q)).map((item, i) => (
                            <div key={i} style={s.workplaceSubItem}>
                              <div style={s.workplaceItemDot} />
                              <p style={s.workplaceItemText}>{highlightText(item)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* ── Letter Template Download ── */}
                <div style={s.letterCard}>
                  <div style={s.letterCardTop}>
                    <div style={s.letterIcon}>
                      <span style={{ fontSize: "26px" }}>📄</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={s.letterTitle}>Workplace Accommodations Letter</p>
                      <p style={s.letterSub}>
                        A professionally written template you can customize and submit to your employer or HR.
                        Cites ADA reasonable accommodation language. Edit in any text editor.
                      </p>
                    </div>
                  </div>
                  <div style={s.letterIncludes}>
                    {["Professional HR-ready formatting", "ADA accommodation language", "Editable checklist of specific requests", "Instruction notes in brackets", "FMLA & Title VII references"].map((f, i) => (
                      <div key={i} style={s.letterIncludeItem}>
                        <span style={s.letterCheckmark}>✓</span>
                        <p style={s.letterIncludeText}>{f}</p>
                      </div>
                    ))}
                  </div>
                  <button style={s.letterDownloadBtn} onClick={downloadLetterTemplate}>
                    <span style={{ fontSize: "18px" }}>⬇️</span>
                    Download Letter Template (.txt)
                  </button>
                  <p style={s.letterDisclaimer}>
                    This template is for informational purposes only and does not constitute legal advice.
                    Consult an employment attorney for guidance specific to your situation and state.
                  </p>
                </div>

                {/* B2B callout */}
                <div style={s.b2bCallout}>
                  <p style={s.b2bTitle}>🏢 Is your company menopause-ready?</p>
                  <p style={s.b2bText}>
                    FLASHYAF™ partners with employers to build inclusive menopause support programs —
                    reducing absenteeism, retaining experienced talent, and creating workplaces where
                    women don't have to choose between their health and their career.
                  </p>
                  <p style={s.b2bContact}>Contact us: iva@brownworks4u2.com</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Existing Sections ──────────────────────────────────── */}
        {filteredSections.map((section) => {
          const isOpen = openSections.has(section.id);
          return (
            <div
              key={section.id}
              style={{ ...s.sectionCard, background: section.bg, border: `1px solid ${section.border}` }}
            >
              <button style={s.sectionHeader} onClick={() => toggleSection(section.id)}>
                <div style={{ ...s.sectionIconCircle, background: `${section.color}22` }}>
                  <span style={s.sectionIconEmoji}>{section.icon}</span>
                </div>
                <div style={s.sectionTitleWrap}>
                  <p style={{ ...s.sectionTitle, color: section.color }}>{highlightText(section.title)}</p>
                  {!isOpen && <p style={s.sectionPreview}>{section.bullets.length} topics covered</p>}
                </div>
                <span style={{ ...s.chevron, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
              </button>

              {isOpen && (
                <div style={s.sectionContent}>
                  <p style={s.sectionIntro}>{highlightText(section.intro)}</p>
                  <div style={s.bulletList}>
                    {section.bullets.map((bullet, i) => (
                      <div key={i} style={s.bulletRow}>
                        <div style={{ ...s.bulletDot, background: section.color }} />
                        <p style={s.bulletText}>{highlightText(bullet)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Footer */}
        <div style={s.footer}>
          <p style={s.footerTitle}>📚 FLASHYAF™ Education Hub</p>
          <p style={s.footerText}>
            Content is for educational purposes only and does not constitute medical advice.
            Always consult a qualified healthcare provider for personal medical decisions.
          </p>
        </div>

        <div style={{ height: "24px" }} />
      </div>

      {/* Bottom Nav */}
      <div style={s.bottomNav}>
        <button style={s.navBtn} onClick={() => onNavigate("home")}>
          <span>🏠</span><span style={s.navLabel}>Home</span>
        </button>
        <button style={s.navBtn} onClick={() => onNavigate("history")}>
          <span>📋</span><span style={s.navLabel}>History</span>
        </button>
        <button style={s.navBtn} onClick={() => onNavigate("community")}>
          <span>💬</span><span style={s.navLabel}>Community</span>
        </button>
        <button style={{ ...s.navBtn, ...s.navBtnActive }} onClick={() => onNavigate("learn")}>
          <span>📚</span><span style={s.navLabel}>Learn</span>
        </button>
        <button style={s.navBtn} onClick={() => onNavigate("shop")}>
          <span>🛍️</span><span style={s.navLabel}>Shop</span>
        </button>
        <button style={s.navBtn} onClick={() => onNavigate("settings")}>
          <span>⚙️</span><span style={s.navLabel}>Settings</span>
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh", background: "var(--color-bg)",
    display: "flex", flexDirection: "column",
    maxWidth: "480px", margin: "0 auto",
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    padding: "18px 16px 12px", textAlign: "center",
    borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
  },
  appName: {
    color: "var(--color-accent)", fontSize: "11px", fontWeight: 900,
    letterSpacing: "2px", margin: "0 0 2px",
  },
  headerTitle: { color: "#fff", fontSize: "22px", fontWeight: 800, margin: "0 0 2px" },
  headerSub: { color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 },

  searchWrap: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "10px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
  },
  searchIcon: { fontSize: "16px", flexShrink: 0 },
  searchInput: {
    flex: 1, background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "100px", color: "#fff",
    fontSize: "14px", fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
    padding: "10px 16px", outline: "none",
  },
  searchClear: {
    background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%",
    width: "28px", height: "28px", cursor: "pointer",
    color: "rgba(255,255,255,0.5)", fontSize: "12px",
    fontFamily: "'Inter', sans-serif", flexShrink: 0,
  },

  scroll: {
    flex: 1, overflowY: "auto",
    padding: "12px 12px 0",
    display: "flex", flexDirection: "column", gap: "10px",
  },

  emptySearch: {
    textAlign: "center", padding: "48px 24px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
  },
  emptySearchIcon: { fontSize: "40px", margin: 0 },
  emptySearchText: { color: "rgba(255,255,255,0.4)", fontSize: "15px", margin: 0 },
  emptySearchClear: {
    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "100px", color: "rgba(255,255,255,0.6)",
    fontSize: "13px", fontWeight: 600, padding: "8px 20px",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
  },

  // ── Know Your Symptoms section ──────────────────────────────
  symptomSection: {
    background: "rgba(255,107,157,0.06)",
    border: "1px solid rgba(255,107,157,0.25)",
    borderRadius: "18px",
    overflow: "hidden",
  },
  symptomSectionHeader: {
    width: "100%", background: "transparent", border: "none",
    display: "flex", alignItems: "center", gap: "12px",
    padding: "14px 14px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", textAlign: "left",
  },
  symptomSectionIconCircle: {
    width: "48px", height: "48px", borderRadius: "14px",
    background: "rgba(255,107,157,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  symptomCardsWrap: {
    padding: "0 10px 12px",
    display: "flex", flexDirection: "column", gap: "8px",
  },

  // Individual symptom card
  symptomCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px",
    overflow: "hidden",
  },
  symptomCardHeader: {
    width: "100%", background: "transparent", border: "none",
    display: "flex", alignItems: "flex-start", gap: "12px",
    padding: "12px 12px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", textAlign: "left",
  },
  symptomDot: {
    width: "40px", height: "40px", borderRadius: "12px",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  symptomCardMeta: { flex: 1, display: "flex", flexDirection: "column", gap: "3px" },
  symptomName: { fontSize: "14px", fontWeight: 800, margin: 0, lineHeight: 1.2 },
  symptomSummary: {
    color: "rgba(255,255,255,0.45)", fontSize: "12px",
    lineHeight: 1.45, margin: 0,
  },

  // Expanded symptom detail
  symptomDetail: {
    borderTop: "1px solid rgba(255,255,255,0.07)",
    padding: "14px 12px 12px",
    display: "flex", flexDirection: "column", gap: "14px",
  },
  fieldBlock: { display: "flex", flexDirection: "column", gap: "6px" },
  fieldHeader: { display: "flex", alignItems: "center", gap: "6px" },
  fieldIcon: { fontSize: "13px", lineHeight: 1, flexShrink: 0 },
  fieldLabel: {
    fontSize: "11px", fontWeight: 900,
    letterSpacing: "1px", textTransform: "uppercase" as const,
    margin: 0,
  },
  fieldText: {
    color: "rgba(255,255,255,0.72)", fontSize: "13px",
    lineHeight: 1.65, margin: 0,
  },
  helpList: { display: "flex", flexDirection: "column", gap: "7px" },
  helpRow: { display: "flex", gap: "9px", alignItems: "flex-start" },
  helpDot: {
    width: "5px", height: "5px", borderRadius: "50%",
    flexShrink: 0, marginTop: "7px",
  },
  helpText: {
    color: "rgba(255,255,255,0.72)", fontSize: "13px", lineHeight: 1.6, margin: 0,
  },

  // ── Partner & Caregiver Guide ───────────────────────────────
  partnerSection: {
    background: "rgba(233,30,140,0.05)",
    border: "1px solid rgba(233,30,140,0.25)",
    borderRadius: "18px",
    overflow: "hidden",
  },
  partnerSectionHeader: {
    width: "100%", background: "transparent", border: "none",
    display: "flex", alignItems: "center", gap: "12px",
    padding: "14px 14px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", textAlign: "left" as const,
  },
  partnerIconCircle: {
    width: "48px", height: "48px", borderRadius: "14px",
    background: "rgba(233,30,140,0.14)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  partnerContent: {
    padding: "0 12px 16px",
    display: "flex", flexDirection: "column" as const, gap: "10px",
  },
  partnerIntro: {
    color: "rgba(255,255,255,0.6)", fontSize: "13px",
    lineHeight: 1.65, fontStyle: "italic", margin: 0,
    borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "12px",
  },
  partnerSubCard: {
    borderRadius: "14px", overflow: "hidden",
  },
  partnerSubHeader: {
    width: "100%", background: "transparent", border: "none",
    display: "flex", alignItems: "center", gap: "10px",
    padding: "12px 12px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", textAlign: "left" as const,
  },
  partnerSubIconCircle: {
    width: "38px", height: "38px", borderRadius: "10px",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  partnerSubTitle: {
    fontSize: "13px", fontWeight: 800, margin: "0 0 2px", lineHeight: 1.2,
  },
  partnerSubPreview: {
    color: "rgba(255,255,255,0.3)", fontSize: "11px", fontWeight: 500, margin: 0,
  },
  partnerSubItems: {
    padding: "4px 12px 14px",
    display: "flex", flexDirection: "column" as const, gap: "9px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  partnerSubItem: {
    display: "flex", gap: "10px", alignItems: "flex-start",
  },
  partnerItemDot: {
    width: "5px", height: "5px", borderRadius: "50%",
    flexShrink: 0, marginTop: "7px",
  },
  partnerItemText: {
    color: "rgba(255,255,255,0.78)", fontSize: "13px",
    lineHeight: 1.6, margin: 0,
  },

  // Check-in card
  checkinCard: {
    background: "rgba(233,30,140,0.08)",
    border: "1px solid rgba(233,30,140,0.3)",
    borderRadius: "16px", padding: "16px",
    display: "flex", flexDirection: "column" as const, gap: "14px",
    marginTop: "4px",
  },
  checkinHeader: {
    display: "flex", alignItems: "flex-start", gap: "12px",
  },
  checkinTitle: {
    color: "#fff", fontSize: "14px", fontWeight: 900, margin: "0 0 3px",
  },
  checkinSub: {
    color: "rgba(255,255,255,0.45)", fontSize: "12px",
    lineHeight: 1.5, margin: 0,
  },
  checkinInput: {
    width: "100%", boxSizing: "border-box" as const,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px", color: "#fff",
    fontSize: "13px", fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
    padding: "12px 14px", outline: "none",
  },
  checkinSendBtn: {
    width: "100%",
    background: "linear-gradient(135deg, rgba(233,30,140,0.9), rgba(142,68,173,0.85))",
    border: "none", borderRadius: "12px",
    color: "#fff", fontSize: "14px", fontWeight: 900,
    padding: "14px", fontFamily: "'Inter', sans-serif",
    boxShadow: "0 4px 20px rgba(233,30,140,0.3)",
  },
  checkinSuccess: {
    display: "flex", flexDirection: "column" as const,
    alignItems: "center", gap: "8px", padding: "8px 0",
    textAlign: "center" as const,
  },
  checkinSuccessTitle: {
    color: "#fff", fontSize: "16px", fontWeight: 900, margin: 0,
  },
  checkinSuccessSub: {
    color: "rgba(255,255,255,0.45)", fontSize: "12px",
    lineHeight: 1.5, margin: 0,
  },
  checkinSendAgainBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "100px", color: "rgba(255,255,255,0.6)",
    fontSize: "13px", fontWeight: 700,
    padding: "9px 20px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", marginTop: "4px",
  },

  // ── Workplace Support ───────────────────────────────────────
  workplaceSection: {
    background: "rgba(41,128,185,0.05)",
    border: "1px solid rgba(41,128,185,0.25)",
    borderRadius: "18px",
    overflow: "hidden",
  },
  workplaceSectionHeader: {
    width: "100%", background: "transparent", border: "none",
    display: "flex", alignItems: "center", gap: "12px",
    padding: "14px 14px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", textAlign: "left" as const,
  },
  workplaceIconCircle: {
    width: "48px", height: "48px", borderRadius: "14px",
    background: "rgba(41,128,185,0.14)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  workplaceContent: {
    padding: "0 12px 16px",
    display: "flex", flexDirection: "column" as const, gap: "10px",
  },
  workplaceIntro: {
    color: "rgba(255,255,255,0.6)", fontSize: "13px",
    lineHeight: 1.65, fontStyle: "italic", margin: 0,
    borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "12px",
  },
  statsSection: {
    background: "rgba(41,128,185,0.07)",
    border: "1px solid rgba(41,128,185,0.2)",
    borderRadius: "14px", overflow: "hidden",
  },
  statsSectionHeader: {
    width: "100%", background: "transparent", border: "none",
    display: "flex", alignItems: "center", gap: "8px",
    padding: "12px 12px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", textAlign: "left" as const,
  },
  statsSectionTitle: {
    color: "#fff", fontSize: "13px", fontWeight: 800, margin: 0, flex: 1,
  },
  statsGrid: {
    display: "flex", flexDirection: "column" as const, gap: "0px",
    borderTop: "1px solid rgba(255,255,255,0.07)",
  },
  statCard: {
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  statNumber: {
    color: "#2980B9", fontSize: "22px", fontWeight: 900,
    margin: "0 0 2px", lineHeight: 1.1,
  },
  statLabel: {
    color: "rgba(255,255,255,0.65)", fontSize: "12px",
    lineHeight: 1.5, margin: 0,
  },
  workplaceSubCard: {
    background: "rgba(41,128,185,0.06)",
    border: "1px solid rgba(41,128,185,0.18)",
    borderRadius: "14px", overflow: "hidden",
  },
  workplaceSubHeader: {
    width: "100%", background: "transparent", border: "none",
    display: "flex", alignItems: "center", gap: "10px",
    padding: "12px 12px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", textAlign: "left" as const,
  },
  workplaceSubIconCircle: {
    width: "38px", height: "38px", borderRadius: "10px",
    background: "rgba(41,128,185,0.18)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  workplaceSubTitle: {
    fontSize: "13px", fontWeight: 800, margin: "0 0 2px",
    lineHeight: 1.2, color: "#4BAED6",
  },
  workplaceSubPreview: {
    color: "rgba(255,255,255,0.3)", fontSize: "11px", fontWeight: 500, margin: 0,
  },
  workplaceSubItems: {
    padding: "4px 12px 14px",
    display: "flex", flexDirection: "column" as const, gap: "9px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  workplaceSubItem: {
    display: "flex", gap: "10px", alignItems: "flex-start",
  },
  workplaceItemDot: {
    width: "5px", height: "5px", borderRadius: "50%",
    background: "#2980B9", flexShrink: 0, marginTop: "7px",
  },
  workplaceItemText: {
    color: "rgba(255,255,255,0.78)", fontSize: "13px",
    lineHeight: 1.6, margin: 0,
  },
  // Letter template card
  letterCard: {
    background: "rgba(41,128,185,0.08)",
    border: "1px solid rgba(41,128,185,0.35)",
    borderRadius: "16px", padding: "16px",
    display: "flex", flexDirection: "column" as const, gap: "14px",
  },
  letterCardTop: {
    display: "flex", gap: "12px", alignItems: "flex-start",
  },
  letterIcon: {
    width: "48px", height: "48px", borderRadius: "12px",
    background: "rgba(41,128,185,0.18)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  letterTitle: {
    color: "#fff", fontSize: "14px", fontWeight: 900, margin: "0 0 5px",
  },
  letterSub: {
    color: "rgba(255,255,255,0.5)", fontSize: "12px",
    lineHeight: 1.55, margin: 0,
  },
  letterIncludes: {
    display: "flex", flexDirection: "column" as const, gap: "6px",
  },
  letterIncludeItem: {
    display: "flex", gap: "8px", alignItems: "flex-start",
  },
  letterCheckmark: {
    color: "#2980B9", fontSize: "13px", fontWeight: 900,
    flexShrink: 0, marginTop: "1px",
  },
  letterIncludeText: {
    color: "rgba(255,255,255,0.65)", fontSize: "12px",
    lineHeight: 1.5, margin: 0,
  },
  letterDownloadBtn: {
    width: "100%",
    background: "linear-gradient(135deg, rgba(41,128,185,0.9), rgba(31,97,141,0.9))",
    border: "none", borderRadius: "12px",
    color: "#fff", fontSize: "14px", fontWeight: 900,
    padding: "14px", fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    boxShadow: "0 4px 20px rgba(41,128,185,0.3)",
  },
  letterDisclaimer: {
    color: "rgba(255,255,255,0.25)", fontSize: "11px",
    lineHeight: 1.5, margin: 0, textAlign: "center" as const,
  },
  // B2B callout
  b2bCallout: {
    background: "linear-gradient(135deg, rgba(41,128,185,0.1), rgba(31,97,141,0.08))",
    border: "1px solid rgba(41,128,185,0.2)",
    borderRadius: "14px", padding: "16px",
    display: "flex", flexDirection: "column" as const, gap: "8px",
  },
  b2bTitle: {
    color: "#fff", fontSize: "14px", fontWeight: 900, margin: 0,
  },
  b2bText: {
    color: "rgba(255,255,255,0.6)", fontSize: "13px",
    lineHeight: 1.65, margin: 0,
  },
  b2bContact: {
    color: "#4BAED6", fontSize: "12px", fontWeight: 700, margin: 0,
  },

  // ── Myth Busters section ────────────────────────────────────
  mythSection: {
    background: "rgba(255,69,0,0.05)",
    border: "1px solid rgba(255,69,0,0.25)",
    borderRadius: "18px",
    overflow: "hidden",
  },
  mythSectionHeader: {
    width: "100%", background: "transparent", border: "none",
    display: "flex", alignItems: "center", gap: "12px",
    padding: "14px 14px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", textAlign: "left" as const,
  },
  mythIconCircle: {
    width: "48px", height: "48px", borderRadius: "14px",
    background: "rgba(255,69,0,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  mythCardsWrap: {
    padding: "0 10px 12px",
    display: "flex", flexDirection: "column" as const, gap: "10px",
  },
  mythCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    overflow: "hidden",
  },
  mythBlock: {
    padding: "14px 14px 12px",
    display: "flex", flexDirection: "column" as const, gap: "7px",
  },
  mythLabel: {
    display: "inline-block",
    background: "rgba(192,57,43,0.18)",
    border: "1px solid rgba(192,57,43,0.45)",
    color: "#E74C3C",
    fontSize: "10px", fontWeight: 900,
    letterSpacing: "1.5px",
    padding: "3px 10px", borderRadius: "100px",
    alignSelf: "flex-start" as const,
  },
  mythText: {
    color: "rgba(255,255,255,0.72)", fontSize: "13px",
    fontWeight: 600, lineHeight: 1.55, margin: 0,
    fontStyle: "italic",
  },
  truthDivider: {
    height: "1px",
    background: "linear-gradient(to right, rgba(26,188,156,0.4), rgba(26,188,156,0.05))",
    margin: "0 14px",
  },
  truthBlock: {
    padding: "12px 14px 14px",
    display: "flex", flexDirection: "column" as const, gap: "7px",
    background: "rgba(26,188,156,0.04)",
  },
  truthLabel: {
    display: "inline-block",
    background: "rgba(26,188,156,0.15)",
    border: "1px solid rgba(26,188,156,0.4)",
    color: "#1ABC9C",
    fontSize: "10px", fontWeight: 900,
    letterSpacing: "1.5px",
    padding: "3px 10px", borderRadius: "100px",
    alignSelf: "flex-start" as const,
  },
  truthText: {
    color: "rgba(255,255,255,0.82)", fontSize: "13px",
    fontWeight: 500, lineHeight: 1.65, margin: 0,
  },

  // ── Existing section cards ──────────────────────────────────
  sectionCard: { borderRadius: "18px", overflow: "hidden" },
  sectionHeader: {
    width: "100%", background: "transparent", border: "none",
    display: "flex", alignItems: "center", gap: "12px",
    padding: "14px 14px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", textAlign: "left",
  },
  sectionIconCircle: {
    width: "48px", height: "48px", borderRadius: "14px",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  sectionIconEmoji: { fontSize: "24px", lineHeight: 1 },
  sectionTitleWrap: { flex: 1 },
  sectionTitle: { fontSize: "15px", fontWeight: 800, margin: "0 0 2px", lineHeight: 1.3 },
  sectionPreview: { color: "rgba(255,255,255,0.35)", fontSize: "12px", fontWeight: 500, margin: 0 },
  chevron: {
    color: "rgba(255,255,255,0.35)", fontSize: "18px", flexShrink: 0,
    transition: "transform 0.25s ease", display: "inline-block",
  },
  sectionContent: {
    padding: "0 14px 16px",
    display: "flex", flexDirection: "column", gap: "12px",
  },
  sectionIntro: {
    color: "rgba(255,255,255,0.65)", fontSize: "13px", lineHeight: 1.6,
    fontStyle: "italic", margin: 0,
    borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px",
  },
  bulletList: { display: "flex", flexDirection: "column", gap: "10px" },
  bulletRow: { display: "flex", gap: "10px", alignItems: "flex-start" },
  bulletDot: { width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0, marginTop: "7px" },
  bulletText: { color: "rgba(255,255,255,0.82)", fontSize: "13px", lineHeight: 1.6, margin: 0 },

  footer: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px", padding: "16px",
    display: "flex", flexDirection: "column", gap: "8px",
  },
  footerTitle: {
    color: "rgba(255,255,255,0.55)", fontSize: "12px", fontWeight: 800,
    letterSpacing: "0.5px", margin: 0,
  },
  footerText: { color: "rgba(255,255,255,0.3)", fontSize: "11px", lineHeight: 1.6, margin: 0 },

  bottomNav: {
    display: "flex", borderTop: "1px solid rgba(255,255,255,0.1)",
    background: "var(--color-bg)", padding: "10px 0 18px", flexShrink: 0,
  },
  navBtn: {
    flex: 1, background: "transparent", border: "none",
    color: "rgba(255,255,255,0.4)", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "3px", cursor: "pointer",
    fontSize: "18px", padding: "4px 0",
  },
  navBtnActive: { color: "var(--color-accent)" },
  navLabel: { fontSize: "9px", fontWeight: 600 },
};

// Standard Treatment Guidelines (STG) Book & Clinical Pharmacology Knowledge Base
// Comprehensive authoritative protocols specifying exact Formulation (Inj, Tab, Cap, Inhaler, Infusion), Dose, Route, Frequency & Duration.

export interface StgDrugItem {
  id: string;
  formulation: 'Injection' | 'Tablet' | 'Capsule' | 'Syrup' | 'Inhaler / Respule' | 'Infusion' | 'Drops / Topical' | string;
  genericName: string;
  brandNameExample: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  lineOfTherapy: 'First-Line' | 'Second-Line / Alternative' | 'Acute Emergency / Rescue' | 'Maintenance / Adjuvant' | string;
  clinicalPearl: string;
}

export interface StgDiseaseChapter {
  id: string;
  diseaseName: string;
  specialty: 'Cardiology' | 'Pulmonology' | 'Endocrinology' | 'Nephrology' | 'Infectious Diseases' | 'Neurology' | 'Gastroenterology' | 'Emergency & Critical Care' | 'Rheumatology';
  icd10: string;
  definition: string;
  etiologyAndTriggers: string;
  pathophysiology: string;
  riskFactors: string[];
  complications: string[];
  clinicalManifestations: string[];
  diagnosticCriteria: string;
  pharmacologicalTreatment: StgDrugItem[];
  nonPharmacologicalTreatment: string[];
  contraindicationsAndAdjustments: string;
  monitoringParameters: string;
  guidelineReference: string;
}

export interface CustomUploadedStgBook {
  id: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  totalPages?: number;
  extractedTextSnippet?: string;
  base64Data?: string;
  isDefaultActive: boolean;
}

export const INITIATED_STANDARD_TREATMENT_GUIDE_BOOK: StgDiseaseChapter[] = [
  {
    id: 'stg-adhf',
    diseaseName: 'Acute Decompensated Heart Failure (ADHF) & Cardiorenal Syndrome',
    specialty: 'Cardiology',
    icd10: 'I50.9',
    definition: 'Acute worsening of symptoms and signs of heart failure requiring urgent medical evaluation and intervention, characterized by pulmonary/systemic congestion with or without low systemic perfusion.',
    etiologyAndTriggers: 'Dietary sodium/fluid indiscretion, medication non-adherence, acute coronary syndrome, uncontrolled hypertension, arrhythmias (atrial fibrillation), acute infection, and nephrotoxic medications (NSAIDs).',
    pathophysiology: 'Elevated left ventricular filling pressures transmit retrograde to pulmonary capillaries causing alveolar transudation, while elevated central venous pressure reduces renal venous outflow pressure, precipitating acute cardiorenal injury.',
    riskFactors: ['Pre-existing ischemic cardiomyopathy', 'Hypertension', 'Diabetes mellitus', 'Chronic kidney disease', 'Advanced age (>65)', 'Arrhythmias'],
    complications: ['Cardiogenic shock', 'Acute pulmonary edema', 'Type 1 Cardiorenal syndrome', 'Refractory diuretic resistance', 'Fatal ventricular arrhythmias'],
    clinicalManifestations: ['Orthopnea & paroxysmal nocturnal dyspnea', 'Bilateral pedal edema (pitting +2 to +4)', 'Elevated JVP (>8 cm H2O)', 'Bilateral pulmonary bibasilar crackles', 'S3 gallop rhythm'],
    diagnosticCriteria: 'Elevated NT-proBNP (>300 pg/mL) or BNP (>100 pg/mL), bedside echocardiography showing reduced LVEF / diastolic dysfunction, chest X-ray showing pulmonary congestion/pleural effusion.',
    pharmacologicalTreatment: [
      {
        id: 'adhf-1',
        formulation: 'Injection',
        genericName: 'Furosemide',
        brandNameExample: 'Inj. Lasix (Sanofi) / Salinex',
        dose: '40 mg to 80 mg IV bolus (or 2.5x home oral daily dose)',
        route: 'Intravenous (IV)',
        frequency: 'Twice daily (BD)',
        duration: '3 to 5 days until euvolemic',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Titrate to achieve net negative fluid balance of 1.0-1.5 L/day. Check serum potassium and creatinine daily.',
      },
      {
        id: 'adhf-2',
        formulation: 'Injection',
        genericName: 'Nitroglycerin / Glyceryl Trinitrate',
        brandNameExample: 'Inj. Nitrolingual / Myonit IV',
        dose: '10 to 20 mcg/min IV infusion (titrate by 5-10 mcg/min every 5 min up to 100-200 mcg/min)',
        route: 'Intravenous (IV)',
        frequency: 'Continuous Infusion',
        duration: '24 to 48 hours during acute pulmonary congestion',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Venodilator that reduces pre-load without reflex tachycardia. Hold if systolic BP < 90 mmHg.',
      },
      {
        id: 'adhf-3',
        formulation: 'Tablet',
        genericName: 'Metoprolol Succinate Extended-Release',
        brandNameExample: 'Tab. Betaloc XL 25/50 / Metolar XR',
        dose: '25 mg to 50 mg oral',
        route: 'Oral',
        frequency: 'Once daily (OD)',
        duration: 'Indefinite long-term maintenance',
        lineOfTherapy: 'Maintenance / Adjuvant',
        clinicalPearl: 'Continue maintenance dose if already stable. Do not initiate or up-titrate until patient is fully decongested.',
      },
      {
        id: 'adhf-4',
        formulation: 'Tablet',
        genericName: 'Sacubitril / Valsartan',
        brandNameExample: 'Tab. Vymada 50/100 / Cidmus / Entresto',
        dose: '24/26 mg or 49/51 mg oral',
        route: 'Oral',
        frequency: 'Twice daily (BD)',
        duration: 'Long-term maintenance GDMT',
        lineOfTherapy: 'Maintenance / Adjuvant',
        clinicalPearl: 'First-line ARNI. Initiate once patient is hemodynamically stable. Requires 36-hour washout if switching from ACE inhibitor.',
      },
      {
        id: 'adhf-5',
        formulation: 'Tablet',
        genericName: 'Dapagliflozin',
        brandNameExample: 'Tab. Forxiga 10 mg / Oxra',
        dose: '10 mg oral',
        route: 'Oral',
        frequency: 'Once daily (OD)',
        duration: 'Long-term maintenance GDMT',
        lineOfTherapy: 'Maintenance / Adjuvant',
        clinicalPearl: 'Pillar 4 GDMT for HFrEF and HFpEF. Reduces cardiovascular death and worsening heart failure admissions.',
      },
    ],
    nonPharmacologicalTreatment: [
      'Strict sodium restriction (<2 g/day)',
      'Fluid restriction to 1.5 - 2.0 L/day for severe hyponatremia (<130 mEq/L)',
      'Daily morning weight recording after first void',
      'High Fowler position during acute respiratory distress',
      'Non-invasive positive pressure ventilation (CPAP/BiPAP) for acute cardiogenic pulmonary edema',
    ],
    contraindicationsAndAdjustments: 'Hold ACEi/ARNI/MRA if potassium >5.5 mEq/L or severe acute oliguria. Avoid NSAIDs, calcium channel blockers (diltiazem/verapamil) in reduced EF.',
    monitoringParameters: 'Hourly urine output, daily weights, serum potassium, sodium, BUN, and serum creatinine. Target SBP >100 mmHg.',
    guidelineReference: '2024 AHA/ACC/HFSA Heart Failure Guidelines & ESC 2023 Focused Update on Heart Failure',
  },
  {
    id: 'stg-copd',
    diseaseName: 'Acute Exacerbation of Chronic Obstructive Pulmonary Disease (AECOPD)',
    specialty: 'Pulmonology',
    icd10: 'J44.1',
    definition: 'An acute event characterized by worsening of the patient respiratory symptoms (dyspnea, cough, sputum purulence and volume) that is beyond normal day-to-day variations and leads to a change in medication.',
    etiologyAndTriggers: 'Respiratory viral infections (Rhinovirus, Influenza, RSV), bacterial infections (Haemophilus influenzae, Streptococcus pneumoniae, Moraxella catarrhalis, Pseudomonas), ambient air pollution, cold weather.',
    pathophysiology: 'Intensification of airway inflammation leads to hypersecretion of mucus, mucosal edema, bronchospasm, and dynamic hyperinflation with gas trapping, producing severe ventilation-perfusion mismatch and hypercapnic respiratory failure.',
    riskFactors: ['Chronic heavy tobacco smoking', 'Biomass fuel exposure', 'Occupational dust exposure', 'Severe baseline FEV1 (<50%)', 'History of frequent exacerbations (≥2/year)'],
    complications: ['Acute hypercapnic respiratory failure (respiratory acidosis)', 'Cor pulmonale and right heart failure', 'Secondary bacterial pneumonia', 'Pneumothorax'],
    clinicalManifestations: ['Anthonisen triad: Increased dyspnea, increased sputum volume, increased sputum purulence', 'Tachypnea (>24/min) with pursed-lip breathing', 'Prolonged expiratory phase and diffuse wheezing', 'Use of accessory muscles of respiration', 'Cyanosis and flapping tremor (asterixis) in CO2 retention'],
    diagnosticCriteria: 'ABG demonstrating acute respiratory acidosis (pH <7.35, PaCO2 >45 mmHg), chest radiograph to rule out pneumonia or pneumothorax, spirometry (post-bronchodilator FEV1/FVC <0.70) when stable.',
    pharmacologicalTreatment: [
      {
        id: 'copd-1',
        formulation: 'Inhaler / Respule',
        genericName: 'Levosalbutamol (Levalbuterol) + Ipratropium Bromide',
        brandNameExample: 'Respules Duolin (Cipla) / Combivent',
        dose: 'Levosalbutamol 1.25 mg + Ipratropium 500 mcg via jet nebulizer',
        route: 'Inhalation',
        frequency: 'Every 4 to 6 hours (or every 20-30 min x 3 in severe crisis)',
        duration: '3 to 7 days during acute hospitalization',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Short-acting beta2-agonist + anticholinergic combination provides synergistic bronchodilation and reduces dynamic hyperinflation.',
      },
      {
        id: 'copd-2',
        formulation: 'Injection',
        genericName: 'Hydrocortisone / Methylprednisolone',
        brandNameExample: 'Inj. Solu-Cortef 100 mg / Solu-Medrol 40 mg',
        dose: 'Hydrocortisone 100 mg IV (or Methylprednisolone 40 mg IV)',
        route: 'Intravenous (IV)',
        frequency: 'Twice daily (BD)',
        duration: 'Switch to oral prednisolone 40 mg OD once tolerated (total course 5 days)',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Systemic corticosteroids shorten recovery time, improve FEV1 and oxygenation, and reduce risk of early relapse. Short 5-day course is optimal per REDUCE trial.',
      },
      {
        id: 'copd-3',
        formulation: 'Tablet',
        genericName: 'Amoxicillin + Clavulanic Acid',
        brandNameExample: 'Tab. Augmentin 625 mg (GSK) / Moxikind-CV 625',
        dose: '625 mg (500 mg amoxicillin + 125 mg clavulanate) oral',
        route: 'Oral',
        frequency: 'Three times daily (TDS)',
        duration: '5 to 7 days',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Indicated when all 3 cardinal Anthonisen symptoms are present (especially increased sputum purulence) or patient requires mechanical ventilation.',
      },
      {
        id: 'copd-4',
        formulation: 'Inhaler / Respule',
        genericName: 'Budesonide Respule',
        brandNameExample: 'Respules Budecort 0.5 mg / 1.0 mg (Cipla)',
        dose: '1 mg nebulized via compressor',
        route: 'Inhalation',
        frequency: 'Twice daily (BD)',
        duration: '5 to 7 days',
        lineOfTherapy: 'Maintenance / Adjuvant',
        clinicalPearl: 'Can serve as alternative to systemic steroids in non-acidotic exacerbations or as adjunctive local anti-inflammatory therapy.',
      },
    ],
    nonPharmacologicalTreatment: [
      'Controlled oxygen therapy targeting SpO2 88-92% via Venturi mask (prevents blunting of hypoxic drive)',
      'Non-invasive ventilation (NIV / BiPAP) if PaCO2 >45 mmHg and pH <7.35',
      'Chest physiotherapy and active cycle of breathing techniques',
      'Smoking cessation counseling',
      'Influenza and pneumococcal vaccination prior to discharge',
    ],
    contraindicationsAndAdjustments: 'Avoid non-cardioselective beta-blockers and heavy sedatives/opioids which precipitate fatal respiratory depression. Adjust amoxicillin/clavulanate in severe renal failure (eGFR <30 mL/min).',
    monitoringParameters: 'Serial ABG analysis at 1-2 hours after initiation of oxygen/NIV, continuous pulse oximetry, respiratory rate, sensorium, and sputum color/volume.',
    guidelineReference: 'GOLD 2025 Global Strategy for Diagnosis, Management, and Prevention of COPD',
  },
  {
    id: 'stg-dka',
    diseaseName: 'Diabetic Ketoacidosis (DKA) & Hyperglycemic Crises',
    specialty: 'Endocrinology',
    icd10: 'E10.1',
    definition: 'Acute, life-threatening metabolic complication of diabetes mellitus characterized by the triad of hyperglycemia, high-anion-gap metabolic acidosis, and ketonemia.',
    etiologyAndTriggers: 'Absolute or relative insulin deficiency compounded by counter-regulatory hormone excess (glucagon, catecholamines, cortisol, growth hormone). Common triggers: Infection (UTI, pneumonia, sepsis 30-50%), insulin omission/non-adherence (20-40%), myocardial infarction, stroke, pancreatitis, new-onset diabetes.',
    pathophysiology: 'Insulin deficiency stimulates lipolysis in adipose tissue, releasing free fatty acids that undergo hepatic beta-oxidation into acetoacetate and beta-hydroxybutyrate. High circulating ketoacids consume bicarbonate, generating severe high anion gap acidosis. Concomitant hyperglycemia induces osmotic diuresis with marked electrolyte and volume depletion.',
    riskFactors: ['Type 1 diabetes mellitus', 'Underlying infection or systemic stress', 'Psychosocial factors leading to insulin omission', 'SGLT2 inhibitor use (Euglycemic DKA risk)', 'Substance abuse'],
    complications: ['Cerebral edema (especially in young patients due to rapid osmolality shifts)', 'Severe hypokalemia and fatal cardiac arrest', 'Hypoglycemia from overzealous insulin therapy', 'Acute pulmonary edema from fluid overload', 'Deep venous thrombosis / thromboembolism'],
    clinicalManifestations: ['Polyuria, polydipsia, profound weakness', 'Kussmaul breathing (deep, rapid respiration with fruity/acetone breath odor)', 'Nausea, vomiting, and diffuse abdominal pain mimicking acute abdomen', 'Dehydration signs (dry mucous membranes, sunken eyes, tachycardia, hypotension)', 'Altered sensorium ranging from lethargy to coma'],
    diagnosticCriteria: 'Blood glucose >250 mg/dL, venous pH <7.30, serum bicarbonate <18 mEq/L, anion gap >12 mEq/L, and positive serum/urine beta-hydroxybutyrate / ketones.',
    pharmacologicalTreatment: [
      {
        id: 'dka-1',
        formulation: 'Infusion',
        genericName: 'Normal Saline (0.9% Sodium Chloride IV)',
        brandNameExample: 'IV Fluid 0.9% Normal Saline 1000 mL',
        dose: '1000 mL/hr for the first 1-2 hours, then 250-500 mL/hr based on hydration status',
        route: 'Intravenous (IV)',
        frequency: 'Continuous Infusion',
        duration: 'Until volume restored, then switch to 0.45% Saline once sodium normalized',
        lineOfTherapy: 'Acute Emergency / Rescue',
        clinicalPearl: 'Fluid replacement restores intravascular volume and renal perfusion, lowering glucose by 35-70 mg/dL/hr through urinary clearance alone.',
      },
      {
        id: 'dka-2',
        formulation: 'Injection',
        genericName: 'Regular Crystalline Human Insulin (IV Infusion)',
        brandNameExample: 'Inj. Actrapid / Huminsulin R (Eli Lilly)',
        dose: '0.1 units/kg/hr IV continuous infusion (or 0.14 units/kg/hr if no initial bolus)',
        route: 'Intravenous (IV)',
        frequency: 'Continuous Infusion',
        duration: 'Until DKA resolves (pH >7.30, HCO3 >18, anion gap normal)',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'CRITICAL SAFETY RULE: Never start insulin if serum potassium is <3.3 mEq/L! Correct potassium first to prevent fatal arrhythmias.',
      },
      {
        id: 'dka-3',
        formulation: 'Injection',
        genericName: 'Potassium Chloride (KCl IV)',
        brandNameExample: 'Inj. Potassium Chloride (15% / 20 mEq ampoule)',
        dose: '20 to 30 mEq KCl per liter of IV fluid',
        route: 'Intravenous (IV)',
        frequency: 'Continuous Infusion',
        duration: 'Maintain serum potassium between 4.0 and 5.0 mEq/L throughout insulin therapy',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Insulin drives potassium intracellularly. Failure to replenish potassium causes rapid neuromuscular paralysis and cardiac standstill.',
      },
      {
        id: 'dka-4',
        formulation: 'Injection',
        genericName: 'Insulin Glargine / Degludec (Subcutaneous Basal Bridge)',
        brandNameExample: 'Inj. Lantus / Basalog 100 IU/mL',
        dose: '10 to 20 units SC given 2 hours BEFORE stopping IV insulin infusion',
        route: 'Subcutaneous (SC)',
        frequency: 'Once daily (OD)',
        duration: 'Transition to long-term basal-bolus regimen',
        lineOfTherapy: 'Maintenance / Adjuvant',
        clinicalPearl: 'Overlap basal subcutaneous insulin by 2 hours before terminating IV insulin to prevent catastrophic rebound ketoacidosis.',
      },
    ],
    nonPharmacologicalTreatment: [
      'Frequent fingerstick glucose checks every 1 hour during IV insulin infusion',
      'Strict intake-output chart with Foley catheter in comatose patients',
      'Nasogastric tube decompression if gastric atony or severe vomiting present',
      'Continuous cardiac rhythm monitoring during electrolyte repletion',
      'Identify and aggressively treat underlying precipitating infectious trigger',
    ],
    contraindicationsAndAdjustments: 'Do not administer sodium bicarbonate unless pH <6.90. When glucose drops to 200-250 mg/dL, add 5% Dextrose to IV fluids while maintaining insulin infusion to completely clear ketoacidosis.',
    monitoringParameters: 'Hourly blood glucose, venous blood gas and electrolytes (K+, Na+, Cl-, HCO3-) every 2 to 4 hours, anion gap calculations until closure (<12 mEq/L).',
    guidelineReference: 'ADA Standards of Care 2025 & Joint British Diabetes Societies (JBDS) Inpatient DKA Guidelines',
  },
  {
    id: 'stg-pneumonia',
    diseaseName: 'Community-Acquired Pneumonia (CAP) - Inpatient Ward',
    specialty: 'Infectious Diseases',
    icd10: 'J18.9',
    definition: 'Acute infection of the pulmonary parenchymal tissue acquired outside of healthcare facilities, resulting in exudative consolidation of alveolar spaces.',
    etiologyAndTriggers: 'Streptococcus pneumoniae (most common typical pathogen), Haemophilus influenzae, atypical pathogens (Mycoplasma pneumoniae, Chlamydia pneumoniae, Legionella pneumophila), respiratory viruses (Influenza, SARS-CoV-2, RSV).',
    pathophysiology: 'Microorganisms breach upper airway mucosal barriers, colonize alveolar sacs, and trigger an intense neutrophilic and macrophage inflammatory exudation filling alveoli with fibrin and purulent debris, causing severe V/Q mismatch.',
    riskFactors: ['Age ≥65 years', 'Chronic comorbidities (COPD, asthma, diabetes, heart failure, CKD, cirrhosis)', 'Immunosuppression / corticosteroid use', 'Tobacco smoking and alcohol abuse', 'Aspiration risk (stroke, dementia)'],
    complications: ['Parapneumonic effusion and empyema', 'Acute respiratory distress syndrome (ARDS)', 'Septic shock with multiorgan failure', 'Metastatic abscess formation', 'Acute cardiac events (MI, atrial fibrillation)'],
    clinicalManifestations: ['High fever with rigors and chills', 'Cough with purulent or rust-colored sputum', 'Pleuritic chest pain aggravated by deep inspiration', 'Dyspnea and tachypnea (>20 breaths/min)', 'Dullness to percussion, bronchial breath sounds, and inspiratory crackles'],
    diagnosticCriteria: 'New pulmonary infiltrates or consolidation on chest radiograph or CT, plus clinical signs of infection (fever, leukocytosis >12,000/mcL or leukopenia <4,000/mcL). CURB-65 score ≥2 indicates inpatient care.',
    pharmacologicalTreatment: [
      {
        id: 'cap-1',
        formulation: 'Injection',
        genericName: 'Ceftriaxone',
        brandNameExample: 'Inj. Monocef 1 g / Rocephin',
        dose: '1 g to 2 g IV',
        route: 'Intravenous (IV)',
        frequency: 'Once daily (OD)',
        duration: '5 to 7 days',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Third-generation cephalosporin with excellent coverage for Streptococcus pneumoniae and common gram-negative bacilli. Highly protein bound.',
      },
      {
        id: 'cap-2',
        formulation: 'Tablet',
        genericName: 'Azithromycin',
        brandNameExample: 'Tab. Azithral 500 mg (Alembic) / Zithromax',
        dose: '500 mg oral on day 1, then 250-500 mg once daily',
        route: 'Oral',
        frequency: 'Once daily (OD)',
        duration: '5 days',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Macrolide covering atypical pathogens (Mycoplasma, Legionella, Chlamydia) and possessing immunomodulatory anti-inflammatory properties.',
      },
      {
        id: 'cap-3',
        formulation: 'Tablet',
        genericName: 'Paracetamol / Acetaminophen',
        brandNameExample: 'Tab. Dolo 650 mg (Micro Labs) / Calpol',
        dose: '650 mg oral',
        route: 'Oral',
        frequency: 'As needed (SOS / PRN) up to TDS',
        duration: '3 to 5 days for fever and pleuritic pain relief',
        lineOfTherapy: 'Maintenance / Adjuvant',
        clinicalPearl: 'Safe antipyretic. Do not exceed 3-4 g in 24 hours. Reduce in liver disease.',
      },
      {
        id: 'cap-4',
        formulation: 'Injection',
        genericName: 'Piperacillin + Tazobactam',
        brandNameExample: 'Inj. Pipzo 4.5 g (Sun Pharma) / Zosyn',
        dose: '4.5 g (4 g piperacillin + 0.5 g tazobactam) IV',
        route: 'Intravenous (IV)',
        frequency: 'Every 6 hours (or 3.375 g q6h / extended infusion)',
        duration: '7 to 10 days for high-risk / pseudomonal pneumonia',
        lineOfTherapy: 'Second-Line / Alternative',
        clinicalPearl: 'Indicated if patient has risk factors for Pseudomonas aeruginosa (bronchiectasis, prior colonization, recent IV antibiotic use in past 90 days).',
      },
    ],
    nonPharmacologicalTreatment: [
      'Humidified oxygen therapy via nasal cannula to keep SpO2 >92% (88-92% in COPD)',
      'Adequate hydration (oral or IV fluids) to liquefy tracheobronchial secretions',
      'Early mobilization within 24 hours of clinical stabilization',
      'Incentive spirometry every 1-2 hours while awake to prevent atelectasis',
      'Pneumococcal (PCV20/PPSV23) and Influenza vaccines prior to discharge',
    ],
    contraindicationsAndAdjustments: 'Adjust ceftriaxone in severe combined renal and hepatic failure. Ceftriaxone is contraindicated with calcium-containing IV solutions in neonates. Screen for QTc prolongation before macrolide therapy.',
    monitoringParameters: 'Vitals (temperature, respiratory rate, HR, BP, SpO2) every 4 hours. Daily assessment of clinical stability criteria (fever resolution, oral intake, sensorium).',
    guidelineReference: 'ATS/IDSA 2019 Community-Acquired Pneumonia Guidelines & British Thoracic Society (BTS) CAP Guidelines',
  },
  {
    id: 'stg-aki',
    diseaseName: 'Acute Kidney Injury (AKI) - Prerenal & Drug-Induced Tubulopathy',
    specialty: 'Nephrology',
    icd10: 'N17.9',
    definition: 'Abrupt decrease in kidney function occurring over hours to days, characterized by a sudden reduction in glomerular filtration rate (GFR) and accumulation of nitrogenous waste products (urea, creatinine).',
    etiologyAndTriggers: 'Volume depletion (diarrhea, vomiting, bleeding, dehydration), systemic hypoperfusion (heart failure, sepsis, cirrhosis), and nephrotoxic medications: NSAIDs (afferent arteriolar vasoconstriction), ACEi/ARBs (efferent arteriolar vasodilation), aminoglycosides, vancomycin, radiocontrast media.',
    pathophysiology: 'Hypoperfusion reduces glomerular hydrostatic pressure. In severe or prolonged ischemia, tubular epithelial cells undergo apoptosis and necrosis (Acute Tubular Necrosis - ATN) with detachment of cells into tubular lumens causing obstructive casts.',
    riskFactors: ['Pre-existing chronic kidney disease (baseline eGFR <60 mL/min)', 'Advanced age (>65)', 'Diabetes mellitus', 'Congestive heart failure and liver cirrhosis', 'Concurrent polypharmacy with nephrotoxic agents'],
    complications: ['Severe hyperkalemia with life-threatening cardiac conduction blocks', 'Metabolic acidosis with Kussmaul respiration', 'Volume overload and pulmonary edema', 'Uremic pericarditis and encephalopathy', 'Progression to End-Stage Renal Disease (ESRD)'],
    clinicalManifestations: ['Oliguria (<400 mL/day) or anuria (<100 mL/day)', 'Peripheral edema, facial puffiness, rapid weight gain from fluid retention', 'Nausea, anorexia, metallic taste, pruritus', 'Confusion, asterixis, and uremic frost in advanced uremia', 'Elevated blood pressure or postural drop in prerenal volume loss'],
    diagnosticCriteria: 'KDIGO criteria: Rise in serum creatinine by ≥0.3 mg/dL within 48 hours, or ≥1.5-fold increase from baseline within 7 days, or urine volume <0.5 mL/kg/h for 6 hours.',
    pharmacologicalTreatment: [
      {
        id: 'aki-1',
        formulation: 'Infusion',
        genericName: 'Balanced Crystalloid (Ringer Lactate / Plasmalyte IV)',
        brandNameExample: 'IV Fluid Ringer Lactate 500 mL / 1000 mL',
        dose: '500 to 1000 mL IV bolus, then adjust based on hemodynamic response',
        route: 'Intravenous (IV)',
        frequency: 'Continuous Infusion',
        duration: 'Until euvolemia restored',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Preferred over 0.9% Normal Saline in large volume resuscitation to avoid hyperchloremic metabolic acidosis and renal vasoconstriction (SMART/SALT-ED trials).',
      },
      {
        id: 'aki-2',
        formulation: 'Injection',
        genericName: 'Calcium Gluconate 10% (for Hyperkalemia Cardioprotection)',
        brandNameExample: 'Inj. Calcium Gluconate 10% (10 mL ampoule)',
        dose: '10 mL of 10% solution IV over 2 to 5 minutes',
        route: 'Intravenous (IV)',
        frequency: 'As needed (SOS / PRN) for ECG changes',
        duration: 'May repeat in 5-10 minutes if ECG changes persist',
        lineOfTherapy: 'Acute Emergency / Rescue',
        clinicalPearl: 'Membrane stabilizer that antagonizes potassium cardiotoxicity immediately. Does not lower serum potassium level.',
      },
      {
        id: 'aki-3',
        formulation: 'Injection',
        genericName: 'Regular Human Insulin + 25% or 50% Dextrose (Shift Agent)',
        brandNameExample: 'Inj. Actrapid 10 IU in 100 mL 25% Dextrose IV',
        dose: '10 units regular insulin IV with 50 mL of 50% Dextrose (or 100 mL of 25% Dextrose)',
        route: 'Intravenous (IV)',
        frequency: 'As needed (SOS / PRN) for hyperkalemia',
        duration: 'Shifts potassium within 15-30 minutes, lasts 4-6 hours',
        lineOfTherapy: 'Acute Emergency / Rescue',
        clinicalPearl: 'Drives potassium into cells via Na+/K+ ATPase pump stimulation. Monitor blood glucose at 1 and 2 hours to avoid hypoglycemia.',
      },
      {
        id: 'aki-4',
        formulation: 'Tablet',
        genericName: 'Sodium Polystyrene Sulfonate / Patiromer',
        brandNameExample: 'Sachet K-Bind 15 g (Shield Healthcare) / Veltassa',
        dose: '15 g sachet oral mixed in water',
        route: 'Oral',
        frequency: 'Once to twice daily (BD)',
        duration: 'Until serum potassium <5.0 mEq/L',
        lineOfTherapy: 'Maintenance / Adjuvant',
        clinicalPearl: 'Potassium binder that eliminates potassium through GI tract. Avoid sodium polystyrene sulfonate with sorbitol due to bowel necrosis risk.',
      },
    ],
    nonPharmacologicalTreatment: [
      'IMMEDIATELY HOLD all nephrotoxic drugs: NSAIDs, ACE inhibitors, ARBs, SGLT2 inhibitors, aminoglycosides',
      'Adjust all renally cleared drugs according to estimated GFR',
      'Daily weight and strict fluid intake-output balance (insensible loss 500 mL + previous day urine output)',
      'Low potassium diet (<2 g/day) and low phosphorus diet',
      'Emergent renal replacement therapy (hemodialysis) for refractory AEIOU: Acidosis (pH <7.15), Electrolytes (K >6.5), Ingestion, Overload (pulmonary edema), Uremia',
    ],
    contraindicationsAndAdjustments: 'Never give NSAIDs or potassium-sparing diuretics (spironolactone, amiloride). Restrict phosphate and magnesium supplements.',
    monitoringParameters: 'Serum creatinine, BUN, potassium, sodium, and bicarbonate every 12 to 24 hours. Hourly urine output measurement. Continuous ECG monitoring if K >6.0 mEq/L.',
    guidelineReference: 'KDIGO 2024 Clinical Practice Guideline for Acute Kidney Injury',
  },
  {
    id: 'stg-htn',
    diseaseName: 'Essential Hypertension & Hypertensive Urgency',
    specialty: 'Cardiology',
    icd10: 'I10',
    definition: 'Sustained elevation of systemic arterial blood pressure (office BP ≥140/90 mmHg or 24-hr ambulatory BP ≥130/80 mmHg). Hypertensive urgency refers to severe BP elevation (>180/120 mmHg) without acute target organ damage.',
    etiologyAndTriggers: 'Multifactorial polygenic inheritance interacting with environmental triggers: high sodium intake, sedentary lifestyle, obesity, chronic psychosocial stress, sleep apnea, and excessive alcohol consumption.',
    pathophysiology: 'Increased peripheral vascular resistance from vascular smooth muscle hyper-reactivity, inappropriate renin-angiotensin-aldosterone axis activation, sympathetic over-activity, and blunted renal pressure-natriuresis.',
    riskFactors: ['Family history of premature cardiovascular disease', 'Obesity (BMI ≥30 kg/m²)', 'Excessive dietary sodium (>5 g salt/day)', 'Type 2 diabetes', 'Dyslipidemia', 'Obstructive sleep apnea'],
    complications: ['Hemorrhagic and ischemic stroke', 'Coronary artery disease and myocardial infarction', 'Left ventricular hypertrophy (LVH) and heart failure', 'Hypertensive nephrosclerosis and chronic kidney disease', 'Hypertensive retinopathy'],
    clinicalManifestations: ['Frequently asymptomatic ("silent killer")', 'Occipital morning headache in severe elevations', 'Dizziness, lightheadedness, and palpitations', 'Epistaxis (nosebleeds) in sudden spikes', 'Blurred vision and bilateral retinal arteriolar narrowing on fundoscopy'],
    diagnosticCriteria: 'Average of ≥2 properly performed office BP readings on ≥2 separate visits demonstrating SBP ≥140 mmHg and/or DBP ≥90 mmHg, or 24-hour ambulatory blood pressure monitoring (ABPM) ≥130/80 mmHg.',
    pharmacologicalTreatment: [
      {
        id: 'htn-1',
        formulation: 'Tablet',
        genericName: 'Telmisartan',
        brandNameExample: 'Tab. Telma 40 mg (Glenmark) / Micardis',
        dose: '40 mg to 80 mg oral',
        route: 'Oral',
        frequency: 'Once daily (OD)',
        duration: 'Indefinite chronic therapy',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Angiotensin II Receptor Blocker with long half-life (24 hours), provides smooth BP control and PPAR-gamma agonism beneficial in metabolic syndrome.',
      },
      {
        id: 'htn-2',
        formulation: 'Tablet',
        genericName: 'Amlodipine Besylate',
        brandNameExample: 'Tab. Amlong 5 mg (Micro Labs) / Norvasc',
        dose: '5 mg to 10 mg oral',
        route: 'Oral',
        frequency: 'Once daily (OD)',
        duration: 'Indefinite chronic therapy',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Dihydropyridine calcium channel blocker. Excellent stroke prevention. Combination with ARB provides synergistic BP reduction and mitigates ankle edema.',
      },
      {
        id: 'htn-3',
        formulation: 'Tablet',
        genericName: 'Chlorthalidone / Indapamide',
        brandNameExample: 'Tab. CTD 12.5 mg / Natrilix SR 1.5 mg',
        dose: '12.5 mg to 25 mg oral',
        route: 'Oral',
        frequency: 'Once daily (OD)',
        duration: 'Indefinite chronic therapy',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Thiazide-like diuretic preferred over hydrochlorothiazide due to longer duration of action and superior trial evidence for cardiovascular event reduction (ALLHAT).',
      },
      {
        id: 'htn-4',
        formulation: 'Tablet',
        genericName: 'Labetalol / Clonidine (for Hypertensive Urgency)',
        brandNameExample: 'Tab. Gravidol 100 mg / Arkamin 0.1 mg',
        dose: '100 mg to 200 mg oral (Labetalol) or 0.1 mg oral (Clonidine)',
        route: 'Oral',
        frequency: 'Once, repeat in 1-2 hours if needed',
        duration: 'Acute outpatient stabilization',
        lineOfTherapy: 'Acute Emergency / Rescue',
        clinicalPearl: 'For hypertensive urgency without target organ damage, lower BP gradually over 24-48 hours using oral agents. Never drop BP precipitously with sublingual nifedipine.',
      },
    ],
    nonPharmacologicalTreatment: [
      'DASH (Dietary Approaches to Stop Hypertension) diet rich in fruits, vegetables, and low-fat dairy',
      'Sodium restriction to <1500 mg/day (or at least 1000 mg/day reduction)',
      'Regular aerobic physical activity (≥150 min/week of moderate intensity exercise)',
      'Weight loss (expect ~1 mmHg reduction per 1 kg of weight loss in overweight patients)',
      'Moderation of alcohol consumption and smoking cessation',
    ],
    contraindicationsAndAdjustments: 'ACE inhibitors and ARBs are absolutely contraindicated in pregnancy (teratogenic) and bilateral renal artery stenosis. Monitor for hypokalemia with thiazides and peripheral edema with amlodipine.',
    monitoringParameters: 'Home blood pressure monitoring (HBPM) logs. Target BP <130/80 mmHg in most adults. Check serum electrolytes (potassium, sodium) and serum creatinine 2 to 4 weeks after starting ARB or diuretic.',
    guidelineReference: '2024 ESC Guidelines for the Management of Elevated Blood Pressure & 2020 International Society of Hypertension (ISH) Global Guidelines',
  },
  {
    id: 'stg-sepsis',
    diseaseName: 'Sepsis & Septic Shock (Hour-1 Bundle Protocol)',
    specialty: 'Emergency & Critical Care',
    icd10: 'A41.9',
    definition: 'Life-threatening organ dysfunction caused by a dysregulated host response to infection. Septic shock is a subset of sepsis with profound circulatory, cellular, and metabolic abnormalities (persisting hypotension requiring vasopressors to maintain MAP ≥65 mmHg and lactate >2 mmol/L despite adequate fluid resuscitation).',
    etiologyAndTriggers: 'Bacterial infections (Gram-negative bacilli: E. coli, Klebsiella, Pseudomonas; Gram-positive cocci: S. aureus, S. pneumoniae, Enterococcus), fungal infections (Candida), and viral pathogens. Common sources: pneumonia, urinary tract infection, intra-abdominal peritonitis, skin/soft tissue, catheter-related bloodstream infection.',
    pathophysiology: 'Pathogen-associated molecular patterns (PAMPs) trigger widespread activation of pattern recognition receptors (TLRs), inducing a massive cytokine storm (TNF-alpha, IL-1, IL-6). This precipitates diffuse endothelial damage, systemic capillary leak, loss of vascular tone, microvascular thrombosis (DIC), and cellular mitochondrial dysoxia.',
    riskFactors: ['Extremes of age (<1 year or >65 years)', 'Immunocompromise (chemotherapy, HIV, asplenia, corticosteroids)', 'Invasive medical devices (indwelling catheters, central lines, endotracheal tubes)', 'Chronic organ failure (cirrhosis, ESRD, diabetes)', 'Recent surgical procedure or hospitalization'],
    complications: ['Multiple Organ Dysfunction Syndrome (MODS)', 'Disseminated Intravascular Coagulation (DIC)', 'Acute Respiratory Distress Syndrome (ARDS)', 'Acute Tubular Necrosis (ATN)', 'Persistent critical illness and cognitive impairment'],
    clinicalManifestations: ['qSOFA criteria: Respiratory rate ≥22/min, altered mental status (GCS <15), systolic BP ≤100 mmHg', 'Fever (>38.3°C) or hypothermia (<36.0°C)', 'Tachycardia (>90 beats/min)', 'Warm flushed skin initially (warm shock) transitioning to cold, clammy, mottled extremities', 'Oliguria and delayed capillary refill (>3 seconds)'],
    diagnosticCriteria: 'Suspected infection plus an acute change in total SOFA (Sequential Organ Failure Assessment) score of ≥2 points, serum lactate >2.0 mmol/L, and blood cultures drawn before antibiotics.',
    pharmacologicalTreatment: [
      {
        id: 'sep-1',
        formulation: 'Infusion',
        genericName: 'Balanced Crystalloids (Ringer Lactate IV)',
        brandNameExample: 'IV Fluid Ringer Lactate 500 mL x 4',
        dose: '30 mL/kg IV infused rapidly within first 3 hours',
        route: 'Intravenous (IV)',
        frequency: 'Continuous Infusion',
        duration: 'Hour-1 resuscitation phase',
        lineOfTherapy: 'Acute Emergency / Rescue',
        clinicalPearl: 'Guide ongoing fluids by dynamic measures of fluid responsiveness (passive leg raise, stroke volume variation) rather than static CVP alone.',
      },
      {
        id: 'sep-2',
        formulation: 'Injection',
        genericName: 'Piperacillin + Tazobactam + Vancomycin',
        brandNameExample: 'Inj. Pipzo 4.5 g IV + Inj. Vancocin 1 g to 1.5 g IV',
        dose: 'Pipzo 4.5 g IV stat + Vancomycin 25-30 mg/kg loading dose IV',
        route: 'Intravenous (IV)',
        frequency: 'Stat within 1 hour of recognition',
        duration: '7 to 10 days tailored to culture and sensitivities',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'HOUR-1 BUNDLE MANDATE: Administer broad-spectrum empiric antimicrobials within the first hour of recognition after obtaining 2 sets of blood cultures.',
      },
      {
        id: 'sep-3',
        formulation: 'Infusion',
        genericName: 'Norepinephrine Bitartrate',
        brandNameExample: 'Inj. Noradrenaline / Levophed 4 mg in 50 mL NS',
        dose: '0.05 to 0.5 mcg/kg/min IV infusion titrated via central line',
        route: 'Intravenous (IV)',
        frequency: 'Continuous Infusion',
        duration: 'Until MAP ≥65 mmHg maintained without vasopressor support',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'First-choice vasopressor in septic shock. Potent alpha-1 vasoconstriction with modest beta-1 inotropic support. Add Vasopressin 0.03 units/min if refractory.',
      },
      {
        id: 'sep-4',
        formulation: 'Injection',
        genericName: 'Hydrocortisone',
        brandNameExample: 'Inj. Solu-Cortef 50 mg IV',
        dose: '50 mg IV every 6 hours (or 200 mg/day continuous infusion)',
        route: 'Intravenous (IV)',
        frequency: 'Every 6 hours',
        duration: '5 to 7 days, taper once vasopressors discontinued',
        lineOfTherapy: 'Maintenance / Adjuvant',
        clinicalPearl: 'Indicated only in refractory septic shock where vasopressors and fluid resuscitation fail to restore hemodynamic stability (ADRENAL / APROCCHSS trials).',
      },
    ],
    nonPharmacologicalTreatment: [
      'Draw at least two sets of blood cultures (aerobic and anaerobic) before initiating antibiotics',
      'Remediate anatomical infection source within 6-12 hours (abscess drainage, infected catheter removal, debridement)',
      'Serial dynamic hemodynamic assessment (bedside echocardiography, passive leg raise test)',
      'Maintain head-of-bed elevation at 30-45 degrees to prevent ventilator-associated pneumonia',
      'Lung-protective mechanical ventilation (tidal volume 6 mL/kg predicted body weight, plateau pressure <30 cm H2O)',
    ],
    contraindicationsAndAdjustments: 'Avoid hetastarches / synthetic colloids which cause renal failure and bleeding. Vancomycin requires therapeutic drug monitoring (target AUC/MIC 400-600 or trough 15-20 mcg/mL).',
    monitoringParameters: 'Continuous arterial line blood pressure (MAP ≥65 mmHg), hourly urine output (>0.5 mL/kg/h), repeat serum lactate every 2-4 hours until normalized, central venous oxygen saturation (ScvO2 ≥70%).',
    guidelineReference: 'Surviving Sepsis Campaign (SSC) 2021 International Guidelines for Management of Sepsis and Septic Shock',
  },
  {
    id: 'stg-pud',
    diseaseName: 'Peptic Ulcer Disease (PUD) & Acute Upper GI Bleeding',
    specialty: 'Gastroenterology',
    icd10: 'K27.9',
    definition: 'Mucosal defect in the stomach or duodenum that penetrates through the muscularis mucosae, caused by pepsin and gastric acid hypersecretion or mucosal barrier breakdown.',
    etiologyAndTriggers: 'Helicobacter pylori infection (70-90% duodenal, 50-70% gastric ulcers), chronic NSAID / Aspirin use (inhibits protective mucosal prostaglandins), severe physiologic stress in ICU, Zollinger-Ellison syndrome, cigarette smoking, and corticosteroids (in combination with NSAIDs).',
    pathophysiology: 'Disruption of protective gastric mucosal defenses (bicarbonate secretion, mucous layer, mucosal blood flow, epithelial restitution) driven by H. pylori urease/cytotoxins (CagA, VacA) or NSAID-mediated COX-1 inhibition allows gastric acid and pepsin to digest the underlying lamina propria, eroding blood vessels.',
    riskFactors: ['Elderly age (>65)', 'Concurrent antiplatelet/anticoagulant therapy', 'Prior history of peptic ulcer or GI bleed', 'Heavy alcohol and tobacco consumption', 'High-dose or prolonged NSAID use'],
    complications: ['Acute upper gastrointestinal hemorrhage (hematemesis, melena)', 'Ulcer perforation into peritoneal cavity (acute peritonitis)', 'Gastric outlet obstruction from fibrotic scarring', 'Penetration into pancreas causing pancreatitis'],
    clinicalManifestations: ['Epigastric gnawing or burning pain (duodenal ulcer pain often relieved by food, gastric ulcer aggravated by food)', 'Nocturnal pain awakening patient from sleep', 'Dyspepsia, bloating, early satiety, and nausea', 'Coffee-ground vomiting or frank hematemesis', 'Melena (dark, tarry stools with foul odor) and orthostatic syncope in acute bleed'],
    diagnosticCriteria: 'Upper gastrointestinal endoscopy (Esophagogastroduodenoscopy - EGD) with Forrest classification staging for bleeding ulcers, biopsy for rapid urease test (CLO test) / histology for H. pylori, and stool antigen / urea breath test.',
    pharmacologicalTreatment: [
      {
        id: 'pud-1',
        formulation: 'Injection',
        genericName: 'Pantoprazole IV / Esomeprazole IV',
        brandNameExample: 'Inj. Pantocid 40 mg (Sun Pharma) / Pantop 40',
        dose: '80 mg IV bolus, followed by 8 mg/hr continuous infusion for 72 hours (or 40 mg IV BD)',
        route: 'Intravenous (IV)',
        frequency: 'Twice daily (BD) or Continuous Infusion',
        duration: '72 hours post-endoscopy, then switch to oral 40 mg OD',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Maintains intragastric pH >6.0, which stabilizes platelet aggregation and prevents fibrinolytic dissolution of the clot over the ulcer crater.',
      },
      {
        id: 'pud-2',
        formulation: 'Tablet',
        genericName: 'Amoxicillin + Clarithromycin + Pantoprazole (Triple Therapy)',
        brandNameExample: 'Kit Pylokit / HP-Kit (Cipla) or Individual Tabs',
        dose: 'Pantoprazole 40 mg BD + Amoxicillin 1000 mg BD + Clarithromycin 500 mg BD',
        route: 'Oral',
        frequency: 'Twice daily (BD)',
        duration: '14 consecutive days',
        lineOfTherapy: 'First-Line',
        clinicalPearl: 'Standard 14-day first-line eradication regimen for confirmed H. pylori infection in regions with clarithromycin resistance <15%. Switch to Bismuth quadruple therapy if resistant.',
      },
      {
        id: 'pud-3',
        formulation: 'Capsule',
        genericName: 'Omeprazole / Rabeprazole',
        brandNameExample: 'Cap. Omez 20 mg (Dr. Reddy) / Razo 20 mg',
        dose: '20 mg oral',
        route: 'Oral',
        frequency: 'Once daily (OD) 30 minutes before breakfast',
        duration: '4 to 8 weeks until complete ulcer re-epithelialization',
        lineOfTherapy: 'Maintenance / Adjuvant',
        clinicalPearl: 'Proton pump inhibitor taken on an empty stomach to achieve maximum inhibition of active H+/K+ ATPase pumps.',
      },
      {
        id: 'pud-4',
        formulation: 'Syrup',
        genericName: 'Sucralfate Suspension',
        brandNameExample: 'Syp. Sucrafil 1000 mg / 10 mL (Fourrts)',
        dose: '1 g (10 mL) oral',
        route: 'Oral',
        frequency: 'Four times daily (QID) 1 hour before meals and at bedtime',
        duration: '4 to 6 weeks',
        lineOfTherapy: 'Second-Line / Alternative',
        clinicalPearl: 'Forms a protective cytoprotective paste adhering to ulcer base. Administer at least 2 hours apart from fluoroquinolones, digoxin, or warfarin.',
      },
    ],
    nonPharmacologicalTreatment: [
      'Nothing by mouth (NPO) during acute upper GI bleed until endoscopic evaluation',
      'Endoscopic hemostasis within 24 hours (dual therapy: epinephrine injection plus bipolar electrocoagulation or hemoclip application)',
      'Immediate discontinuation of all NSAIDs, Aspirin, and anticoagulants until bleed resolved',
      'Confirm H. pylori eradication testing (stool antigen or urea breath test) at least 4 weeks after finishing antibiotics and 2 weeks off PPI',
      'Avoid smoking and alcohol which impair mucosal blood flow and delay ulcer healing',
    ],
    contraindicationsAndAdjustments: 'Do not use clarithromycin in patients with high macrolide exposure or prolonged QTc interval. Adjust amoxicillin in severe renal failure. Sucralfate contains aluminum; avoid in end-stage renal disease.',
    monitoringParameters: 'Serial hemoglobin and hematocrit every 6-8 hours until stable, blood transfusion if Hb <7 g/dL (target 7-9 g/dL in non-CAD, >8 g/dL in CAD). Monitor for rebleeding (fresh hematemesis, tachycardia).',
    guidelineReference: 'ACG 2021 Clinical Guideline: Upper Gastrointestinal and Ulcer Bleeding & Maastricht VI / Florence Consensus Report',
  },
];

// Helper to look up disease standard treatment protocols from the initiated book
export function lookupStgChapter(query: string): StgDiseaseChapter | null {
  if (!query || !query.trim()) return null;
  const q = query.toLowerCase().trim();

  // Exact or substring match
  const directMatch = INITIATED_STANDARD_TREATMENT_GUIDE_BOOK.find((ch) =>
    ch.diseaseName.toLowerCase().includes(q) ||
    q.includes(ch.diseaseName.toLowerCase()) ||
    ch.icd10.toLowerCase().includes(q) ||
    ch.specialty.toLowerCase().includes(q)
  );

  if (directMatch) return directMatch;

  // Keyword match
  const keywordMatch = INITIATED_STANDARD_TREATMENT_GUIDE_BOOK.find((ch) => {
    const words = q.split(/\s+/).filter((w) => w.length > 3);
    return words.some(
      (w) =>
        ch.diseaseName.toLowerCase().includes(w) ||
        ch.definition.toLowerCase().includes(w) ||
        ch.etiologyAndTriggers.toLowerCase().includes(w)
    );
  });

  return keywordMatch || null;
}

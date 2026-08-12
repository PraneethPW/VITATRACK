export const calculate = (p) => {
  const weight=Number(p.weight), height=Number(p.height), age=Number(p.age), sex=p.sex||'male';
  const bmr=Math.round(10*weight+6.25*height-5*age+(sex==='male'?5:-161));
  const factor={sedentary:1.2,light:1.375,moderate:1.55,active:1.725,athlete:1.9}[p.activity]||1.55;
  const delta=p.goal==='lose'?-450:p.goal==='gain'?300:0, calories=Math.max(1200,Math.round(bmr*factor+delta));
  const protein=Math.round(weight*(p.goal==='gain'?2:1.8)), fat=Math.round(weight*.8), carbs=Math.round((calories-protein*4-fat*9)/4);
  const stepBase={sedentary:6000,light:7500,moderate:9000,active:11000,athlete:12500}[p.activity]||9000;
  const steps=p.goal==='lose'?stepBase+1500:p.goal==='gain'?stepBase-500:stepBase;
  const goalText=p.goal==='lose'?'a sustainable calorie deficit':p.goal==='gain'?'a gradual surplus for lean mass':'maintenance and performance';
  return {bmr,tdee:Math.round(bmr*factor),calories,protein,fat,carbs,steps,water:Math.round(weight*.035*10)/10,goalText,
    micros:[['Fibre',Math.round(calories/1000*14)+' g'],['Calcium','1,000 mg'],['Iron',sex==='female'?'18 mg':'8 mg'],['Vitamin D','600 IU'],['Potassium','3,400 mg'],['Magnesium',sex==='female'?'320 mg':'420 mg']],
    workouts:[['Mon','Upper strength','Bench press, row, shoulder press · 45 min'],['Tue','Zone 2 cardio','Brisk incline walk or cycle · 35 min'],['Wed','Lower strength','Squat, RDL, split squat · 45 min'],['Thu','Mobility + core','Hip flow, dead bug, plank · 25 min'],['Fri','Full body strength','Push, pull, hinge, carry · 45 min'],['Sat','Active recovery','Easy walk, yoga or sport · 30 min'],['Sun','Rest & reset','Light stretch and meal prep · 15 min']],
    meals:[['Breakfast','Protein oats','Oats, Greek yogurt, berries, chia'],['Lunch','Power bowl','Grain, lean protein, greens, olive oil'],['Snack','Fruit + protein','Fruit with yogurt or protein shake'],['Dinner','Balanced plate','Protein, colourful vegetables, starch']]};
};

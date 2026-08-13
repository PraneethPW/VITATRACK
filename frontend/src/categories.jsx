import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {motion} from 'framer-motion';
import {AreaChart,Area,ResponsiveContainer,XAxis,Tooltip,LineChart,Line} from 'recharts';
import {AlarmClockPlus,BadgeCheck,ChefHat,Droplets,LineChart as LineChartIcon,MoonStar,Trophy,Target,ArrowRight,Plus,Trash2,Check,Clock3} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const api = async (path, opt = {}) => {
  const response = await fetch(API + path, {
    ...opt,
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.token ? {Authorization: 'Bearer ' + localStorage.token} : {}),
      ...opt.headers
    }
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Something went wrong');
  return data;
};

const percent = (a, b) => Math.min(100, Math.round((a / Math.max(b, 1)) * 100));
const Stat = ({label, value, detail, accent}) => <div className={'metric ' + (accent ? 'accent' : '')}><span>{label}</span><b>{value}</b><em>{detail}</em></div>;
const SectionTitle = ({eyebrow, title, sub}) => <header className="pagetitle"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{sub}</p></header>;
const sortByDate = (items) => [...(Array.isArray(items) ? items : [])].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
const last = (items) => (Array.isArray(items) ? items.at(-1) : null);

export function AnalyticsPage({data}) {
  const plan = data.plan;
  const analytics = data.analytics || {};
  const steps = sortByDate(data.steps || []);
  const water = sortByDate(data.water || []);
  const sleep = sortByDate(data.sleep || []);
  const readiness = analytics.readiness || 0;
  const trend = useMemo(() => {
    const merged = new Map();
    for (const item of steps) merged.set(item.date, {date: item.date, steps: item.steps || 0});
    for (const item of water) merged.set(item.date, {...(merged.get(item.date) || {date: item.date}), water: item.ml || 0});
    for (const item of sleep) merged.set(item.date, {...(merged.get(item.date) || {date: item.date}), sleep: item.hours || 0});
    return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  }, [steps, water, sleep]);

  return <div className="page">
    <SectionTitle eyebrow="ANALYTICS" title="Your live performance map." sub="Movement, hydration, sleep and goal progress update from your real logs."/>
    <div className="metrics">
      <Stat label="Readiness" value={`${readiness}%`} detail={analytics.highlights?.[0] || 'Your daily readiness score'} accent/>
      <Stat label="Movement" value={`${analytics.movementScore || 0}%`} detail={`${analytics.stepAvg || 0} avg steps last 7 days`}/>
      <Stat label="Hydration" value={`${analytics.hydrationScore || 0}%`} detail={`${analytics.waterAvg || 0} ml avg last 7 days`}/>
      <Stat label="Sleep" value={`${analytics.sleepScore || 0}%`} detail={`${analytics.sleepAvg || 0} h avg last 7 days`}/>
    </div>
    <div className="dashboard-grid">
      <section className="panel chart">
        <div className="panel-kicker"><LineChartIcon size={14}/> PERFORMANCE TREND</div>
        <h2>Four signals, one timeline.</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trend}>
            <XAxis dataKey="date" stroke="#789"/>
            <Tooltip/>
            <Line type="monotone" dataKey="steps" stroke="#ff5b1d" strokeWidth={2} dot={false}/>
            <Line type="monotone" dataKey="water" stroke="#ffae23" strokeWidth={2} dot={false}/>
            <Line type="monotone" dataKey="sleep" stroke="#ffd15a" strokeWidth={2} dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </section>
      <section className="panel">
        <div className="panel-kicker">SYSTEM HEALTH</div>
        <h2>What the numbers are saying.</h2>
        <div className="readiness-lines">
          {(analytics.highlights || []).map((item, index) => <span key={index}><i/><b>{item}</b><em>{index === 0 ? 'Movement' : index === 1 ? 'Hydration' : 'Sleep'}</em></span>)}
        </div>
        <p className="tiny-note">These scores stay tied to your actual logs. Update them from the dedicated trackers.</p>
      </section>
    </div>
  </div>;
}

export function GoalsPage({data, refresh}) {
  const [form, setForm] = useState({title: '', target: '', unit: 'days', category: 'fitness', dueDate: '', notes: ''});
  const [busy, setBusy] = useState(false);
  const [goals, setGoals] = useState(data.goals || []);

  useEffect(() => setGoals(data.goals || []), [data.goals]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api('/goals', {method: 'POST', body: JSON.stringify(form)});
      setGoals(result.goals);
      setForm({title: '', target: '', unit: 'days', category: 'fitness', dueDate: '', notes: ''});
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const updateGoal = async (id, patch) => {
    const result = await api('/goals/' + id, {method: 'PATCH', body: JSON.stringify(patch)});
    setGoals(result.goals);
    refresh?.();
  };

  const removeGoal = async (id) => {
    const result = await api('/goals/' + id, {method: 'DELETE'});
    setGoals(result.goals);
    refresh?.();
  };

  return <div className="page">
    <SectionTitle eyebrow="GOAL MANAGEMENT" title="Your targets, organized." sub="Set goals, track current progress, and mark them complete when the work is done."/>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-kicker"><Target size={14}/> NEW GOAL</div>
        <h2>Add something worth chasing.</h2>
        <form className="profileform" onSubmit={submit}>
          <label>Goal<input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Walk 60k steps this week"/></label>
          <label>Target<input required type="number" value={form.target} onChange={e => setForm({...form, target: e.target.value})} placeholder="60"/></label>
          <label>Category<select value={form.category} onChange={e => setForm({...form, category: e.target.value})}><option value="fitness">Fitness</option><option value="nutrition">Nutrition</option><option value="sleep">Sleep</option><option value="focus">Focus</option></select></label>
          <label>Unit<select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}><option value="days">Days</option><option value="logs">Logs</option><option value="steps">Steps</option><option value="liters">Liters</option></select></label>
          <label>Due date<input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})}/></label>
          <label>Notes<input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Why this goal matters"/></label>
          <button className="btn" disabled={busy}>{busy ? 'Saving' : 'Create goal'}<ArrowRight size={16}/></button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-kicker">PROGRESS</div>
        <h2>Current goal stack</h2>
        <div className="readiness-lines">
          {goals.length ? goals.map(goal => <span key={goal.id}><i/><b>{goal.title}</b><em>{goal.completed ? 'Done' : `${goal.current || 0}/${goal.target} ${goal.unit}`}</em></span>) : <p className="tiny-note">No goals yet. Start with one small, measurable target.</p>}
        </div>
      </section>
    </div>
    <div className="week">
      {goals.map(goal => <article key={goal.id} className="workout">
        <span>{goal.category?.toUpperCase() || 'GOAL'}</span>
        <h3>{goal.title}</h3>
        <p>{goal.notes || 'Personal target in progress.'}</p>
        <div className="track"><i style={{width: percent(goal.current || 0, goal.target) + '%', background: '#ff5b1d'}}/></div>
        <div className="meal-numbers"><b>{goal.current || 0} <small>current</small></b><b>{goal.target} <small>target</small></b></div>
        <div className="command-tags">
          <button className="btn" onClick={() => updateGoal(goal.id, {current: (goal.current || 0) + 1})}><Plus size={14}/> Progress</button>
          <button className="btn" onClick={() => updateGoal(goal.id, {completed: true, status: 'done'})}><Check size={14}/> Complete</button>
          <button className="btn" onClick={() => removeGoal(goal.id)}><Trash2 size={14}/> Remove</button>
        </div>
      </article>)}
    </div>
  </div>;
}

export function AchievementsPage({data}) {
  const achievements = data.analytics?.achievements || data.achievements || [];
  return <div className="page">
    <SectionTitle eyebrow="ACHIEVEMENTS" title="Your earned progress." sub="Milestones unlock from the profile and the logs you actually build."/>
    <div className="metrics">
      <Stat label="Unlocked" value={achievements.filter(x => x.unlocked).length} detail="Earned badges" accent/>
      <Stat label="Total" value={achievements.length} detail="All milestones"/>
      <Stat label="Profile" value={data.profile ? 'Complete' : 'Setup'} detail="Foundation status"/>
      <Stat label="Momentum" value={`${data.analytics?.readiness || 0}%`} detail="Current readiness"/>
    </div>
    <div className="signal-grid">
      {achievements.map((achievement, index) => <motion.article key={achievement.id || index} initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.35}} className="signal-card">
        <span>{achievement.unlocked ? 'UNLOCKED' : 'IN PROGRESS'}</span>
        <h2>{achievement.title}</h2>
        <b>{achievement.description}</b>
        <p>{achievement.unlocked ? 'You have already earned this marker.' : `Progress: ${achievement.progress || 0}%`}</p>
        <div className="signal-pulse"><i/><i/><i/></div>
      </motion.article>)}
    </div>
  </div>;
}

export function RecipesPage({data, refresh}) {
  const [prompt, setPrompt] = useState(`Generate 3 high-protein recipes for a ${data.profile?.goal || 'balanced'} goal.`);
  const [busy, setBusy] = useState(false);
  const [recipes, setRecipes] = useState(data.recipes || []);

  useEffect(() => setRecipes(data.recipes || []), [data.recipes]);

  const generate = async () => {
    setBusy(true);
    try {
      const result = await api('/recipes/generate', {method: 'POST', body: JSON.stringify({prompt})});
      setRecipes(result.recipes);
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  return <div className="page">
    <SectionTitle eyebrow="AI RECIPES" title="Meals the model can tailor." sub="OpenRouter generates recipes from your actual plan, not from a generic list."/>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-kicker"><ChefHat size={14}/> GENERATE</div>
        <h2>Cook to the plan.</h2>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} className="coach textarea" style={{minHeight: 120}}/>
        <button className="btn" onClick={generate} disabled={busy}>{busy ? 'Thinking' : 'Generate recipes'}<ArrowRight size={16}/></button>
      </section>
      <section className="panel">
        <div className="panel-kicker">LATEST RECOMMENDATIONS</div>
        <h2>Recipes tuned to your goal.</h2>
        <div className="readiness-lines">
          {recipes.slice(-3).map(recipe => <span key={recipe.id || recipe.title}><i/><b>{recipe.title}</b><em>{recipe.mealType}</em></span>)}
        </div>
      </section>
    </div>
    <div className="mealgrid">
      {recipes.slice(-6).map(recipe => <article key={recipe.id || recipe.title} className="meal">
        <span>{String(recipe.mealType || 'meal').toUpperCase()}</span>
        <h2>{recipe.title}</h2>
        <p>{(recipe.ingredients || []).join(', ')}</p>
        <div className="meal-numbers">
          <b>{recipe.macros?.calories || 0} <small>kcal</small></b>
          <b>{recipe.macros?.protein || 0} <small>g protein</small></b>
        </div>
      </article>)}
    </div>
  </div>;
}

export function DietPage({data}) {
  const plan = data.plan;
  const meals = plan?.meals || [];
  return <div className="page">
    <SectionTitle eyebrow="DIET & NUTRITION" title="Your daily food system." sub="Macros, micros, meal rhythm and hydration are all tied to your profile."/>
    <div className="metrics">
      <Stat label="Calories" value={plan?.calories || 0} detail={plan?.goalText || 'Personal target'} accent/>
      <Stat label="Protein" value={`${plan?.protein || 0}g`} detail="Daily floor"/>
      <Stat label="Carbs" value={`${plan?.carbs || 0}g`} detail="Training fuel"/>
      <Stat label="Fats" value={`${plan?.fat || 0}g`} detail="Consistency fuel"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel macro-board">
        <div className="panel-kicker">MACRO SPLIT</div>
        <h2>Eat for the output you want.</h2>
        {[
          ['Protein', plan?.protein || 0, plan?.protein ? plan.protein * 4 : 0, '#ff5b1d', 'repair and retention'],
          ['Carbohydrates', plan?.carbs || 0, plan?.carbs ? plan.carbs * 4 : 0, '#ff9b24', 'training fuel'],
          ['Fats', plan?.fat || 0, plan?.fat ? plan.fat * 9 : 0, '#ffd15a', 'steady energy']
        ].map(([name, grams, calories, color, copy]) => <div className="macro-row" key={name}>
          <div><span>{name}</span><b>{grams}g</b><small>{copy}</small></div>
          <div className="track"><i style={{width: percent(calories, plan?.calories || 1) + '%', background: color}}/></div>
          <em>{Math.round((calories / Math.max(plan?.calories || 1, 1)) * 100)}%</em>
        </div>)}
      </section>
      <section className="panel micro">
        <div className="panel-kicker">MICROS</div>
        <h2>Coverage that keeps the engine running.</h2>
        {(plan?.micros || []).map(item => <div key={item[0]}><span>{item[0]}</span><b>{item[1]}</b></div>)}
      </section>
    </div>
    <div className="week">
      {meals.map(([slot, title, copy]) => <article key={slot} className="workout">
        <span>{slot.toUpperCase()}</span>
        <h3>{title}</h3>
        <p>{copy}</p>
        <b>{plan?.goal === 'lose' ? 'Lean satiety' : plan?.goal === 'gain' ? 'Fuel surplus' : 'Balanced rhythm'}</b>
      </article>)}
    </div>
  </div>;
}

export function WaterPage({data, refresh}) {
  const [ml, setMl] = useState('');
  const [busy, setBusy] = useState(false);
  const logs = sortByDate(data.water || []);
  const today = logs.at(-1)?.ml || 0;
  const average = logs.length ? Math.round(logs.reduce((sum, item) => sum + (item.ml || 0), 0) / logs.length) : 0;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/water', {method: 'POST', body: JSON.stringify({date: new Date().toISOString().slice(0, 10), ml})});
      setMl('');
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  return <div className="page">
    <SectionTitle eyebrow="WATER TRACKER" title="Hydration, logged live." sub="Log water throughout the day and compare it with your calculated target."/>
    <div className="metrics">
      <Stat label="Today" value={`${today} ml`} detail={`${percent(today, data.plan?.water * 1000 || 1)}% of target`} accent/>
      <Stat label="Average" value={`${average} ml`} detail={`${logs.length} logged days`}/>
      <Stat label="Target" value={`${data.plan?.water || 0} L`} detail="Calculated from body weight"/>
      <Stat label="Logs" value={logs.length} detail="Recent entries"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-kicker"><Droplets size={14}/> QUICK LOG</div>
        <h2>Add today&apos;s water.</h2>
        <form className="stepform" onSubmit={submit}>
          <input type="number" min="0" placeholder="Milliliters" value={ml} onChange={e => setMl(e.target.value)}/>
          <button className="btn" disabled={busy}>{busy ? 'Saving' : 'Log water'}<ArrowRight size={16}/></button>
        </form>
      </section>
      <section className="panel chart">
        <div className="panel-kicker">TRACKED HISTORY</div>
        <h2>Hydration trend</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={logs}>
            <XAxis dataKey="date" stroke="#789"/>
            <Tooltip/>
            <Area type="monotone" dataKey="ml" stroke="#ffae23" fill="url(#w)" />
            <defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffae23" stopOpacity=".45"/><stop offset="1" stopColor="#ffae23" stopOpacity="0"/></linearGradient></defs>
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  </div>;
}

export function SleepPage({data, refresh}) {
  const [hours, setHours] = useState('');
  const [quality, setQuality] = useState('3');
  const [busy, setBusy] = useState(false);
  const logs = sortByDate(data.sleep || []);
  const average = logs.length ? +(logs.reduce((sum, item) => sum + (item.hours || 0), 0) / logs.length).toFixed(1) : 0;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/sleep', {method: 'POST', body: JSON.stringify({date: new Date().toISOString().slice(0, 10), hours, quality})});
      setHours('');
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  return <div className="page">
    <SectionTitle eyebrow="SLEEP TRACKER" title="Recovery, watched in real time." sub="Track sleep hours and quality so your readiness score reacts to actual rest."/>
    <div className="metrics">
      <Stat label="Average" value={`${average} h`} detail="Last logged nights" accent/>
      <Stat label="Latest" value={`${last(logs)?.hours || 0} h`} detail={`Quality ${last(logs)?.quality || 0}/5`}/>
      <Stat label="Target" value="7.5 h" detail="Recommended nightly range"/>
      <Stat label="Entries" value={logs.length} detail="Logged nights"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-kicker"><MoonStar size={14}/> LOG SLEEP</div>
        <h2>Capture tonight&apos;s recovery.</h2>
        <form className="profileform" onSubmit={submit}>
          <label>Hours<input type="number" step="0.1" min="0" value={hours} onChange={e => setHours(e.target.value)}/></label>
          <label>Quality<select value={quality} onChange={e => setQuality(e.target.value)}><option value="1">1 / 5</option><option value="2">2 / 5</option><option value="3">3 / 5</option><option value="4">4 / 5</option><option value="5">5 / 5</option></select></label>
          <button className="btn" disabled={busy}>{busy ? 'Saving' : 'Log sleep'}<ArrowRight size={16}/></button>
        </form>
      </section>
      <section className="panel chart">
        <div className="panel-kicker">RECOVERY HISTORY</div>
        <h2>Sleep trend</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={logs}>
            <XAxis dataKey="date" stroke="#789"/>
            <Tooltip/>
            <Line type="monotone" dataKey="hours" stroke="#ffd15a" strokeWidth={2} dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </section>
    </div>
  </div>;
}

export function AlarmPage({data, refresh}) {
  const [label, setLabel] = useState('Wake up');
  const [time, setTime] = useState('07:00');
  const [repeat, setRepeat] = useState('daily');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const fired = useRef(new Set());
  const alarms = Array.isArray(data.alarms) ? data.alarms : [];

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission === 'denied') return;
    const active = alarms.filter((alarm) => alarm.enabled !== false);
    const current = new Date(now);
    const stamp = current.toISOString().slice(0, 16);
    for (const alarm of active) {
      const [hour, minute] = String(alarm.time || '00:00').split(':').map(Number);
      const alarmDate = new Date(current);
      alarmDate.setHours(hour, minute, 0, 0);
      const key = alarm.id + '|' + alarmDate.toISOString().slice(0, 16);
      if (Math.abs(alarmDate.getTime() - current.getTime()) < 15000 && !fired.current.has(key)) {
        fired.current.add(key);
        if (Notification.permission === 'default') Notification.requestPermission().catch(() => {});
        if (Notification.permission === 'granted') new Notification(`VitaTrack alarm: ${alarm.label}`, {body: `Scheduled for ${alarm.time}`});
      }
    }
  }, [now, alarms]);

  const addAlarm = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api('/alarms', {method: 'POST', body: JSON.stringify({label, time, repeat, enabled: true})});
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  const toggleAlarm = async (alarm) => {
    await api('/alarms/' + alarm.id, {method: 'PATCH', body: JSON.stringify({enabled: !alarm.enabled})});
    refresh?.();
  };

  const removeAlarm = async (alarm) => {
    await api('/alarms/' + alarm.id, {method: 'DELETE'});
    refresh?.();
  };

  const nextAlarm = useMemo(() => {
    const active = alarms.filter((alarm) => alarm.enabled !== false).map((alarm) => {
      const [hour, minute] = String(alarm.time || '00:00').split(':').map(Number);
      const date = new Date(now);
      date.setHours(hour, minute, 0, 0);
      if (date.getTime() <= now) date.setDate(date.getDate() + 1);
      return {...alarm, due: date};
    }).sort((a, b) => a.due - b.due);
    return active[0] || null;
  }, [alarms, now]);

  return <div className="page">
    <SectionTitle eyebrow="ALARMS" title="Scheduled actions that fire on time." sub="Use alarms for hydration, workouts, meals, sleep and whatever keeps the day honest."/>
    <div className="metrics">
      <Stat label="Active" value={alarms.filter(a => a.enabled !== false).length} detail="Running reminders" accent/>
      <Stat label="Next" value={nextAlarm ? nextAlarm.time : '--:--'} detail={nextAlarm ? nextAlarm.label : 'No active alarm'}/>
      <Stat label="Repeat" value={repeat} detail="Default schedule"/>
      <Stat label="Clock" value={new Date(now).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} detail="Live time"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-kicker"><AlarmClockPlus size={14}/> CREATE ALARM</div>
        <h2>Set the next trigger.</h2>
        <form className="profileform" onSubmit={addAlarm}>
          <label>Label<input value={label} onChange={e => setLabel(e.target.value)}/></label>
          <label>Time<input type="time" value={time} onChange={e => setTime(e.target.value)}/></label>
          <label>Repeat<select value={repeat} onChange={e => setRepeat(e.target.value)}><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekends">Weekends</option></select></label>
          <button className="btn" disabled={busy}>{busy ? 'Saving' : 'Add alarm'}<ArrowRight size={16}/></button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-kicker">UPCOMING</div>
        <h2>Alarm queue</h2>
        <div className="readiness-lines">
          {alarms.length ? alarms.map(alarm => <span key={alarm.id}><i/><b>{alarm.label}</b><em>{alarm.time} · {alarm.enabled === false ? 'off' : 'on'}</em></span>) : <p className="tiny-note">No alarms yet. Add hydration, meal or sleep reminders.</p>}
        </div>
      </section>
    </div>
    <div className="week">
      {alarms.map(alarm => <article key={alarm.id} className="workout">
        <span>{alarm.repeat?.toUpperCase() || 'DAILY'}</span>
        <h3>{alarm.label}</h3>
        <p>Triggers at {alarm.time}. {alarm.enabled === false ? 'Currently paused.' : 'Currently active.'}</p>
        <div className="command-tags">
          <button className="btn" onClick={() => toggleAlarm(alarm)}>{alarm.enabled === false ? 'Enable' : 'Pause'}</button>
          <button className="btn" onClick={() => removeAlarm(alarm)}><Trash2 size={14}/> Remove</button>
        </div>
      </article>)}
    </div>
  </div>;
}

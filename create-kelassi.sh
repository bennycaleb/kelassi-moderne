#!/bin/bash
set -e

mkdir -p src/{components,pages,styles} public

cat > package.json <<'JSON'
{
  "name": "kelassi-moderne",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "react": "latest",
    "react-dom": "latest",
    "lucide-react": "latest"
  },
  "devDependencies": {}
}
JSON

cat > index.html <<'HTML'
<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>kelassi_moderne</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
HTML

cat > src/main.jsx <<'JS'
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, FileText,
  ClipboardCheck, CalendarDays, Bell, Settings, Search,
  Menu, X, TrendingUp, Clock, Upload, ChevronRight
} from 'lucide-react';
import './styles/app.css';

const menu = [
  ['Dashboard', LayoutDashboard],
  ['Étudiants', Users],
  ['Enseignants', GraduationCap],
  ['Cours', BookOpen],
  ['Devoirs', ClipboardCheck],
  ['Notes & moyennes', FileText],
  ['Emploi du temps', CalendarDays],
  ['Annonces', Bell],
  ['Paramètres', Settings]
];

const students = [
  ['Marie Dupont','L2 Informatique','14,8/20','Active'],
  ['Jean Martin','L2 Informatique','15,6/20','Active'],
  ['Sarah Kabila','L1 Informatique','13,9/20','Active'],
  ['David Ilunga','L3 Informatique','16,2/20','Active'],
  ['Paul Nzambe','L1 Informatique','12,7/20','À suivre']
];

function App(){
  const [active,setActive] = useState('Dashboard');
  const [mobile,setMobile] = useState(false);

  const renderContent = () => {
    if(active === 'Étudiants') return <Students />;
    if(active === 'Cours') return <Courses />;
    if(active === 'Devoirs') return <Assignments />;
    if(active === 'Notes & moyennes') return <Grades />;
    if(active === 'Enseignants') return <Teachers />;
    return <Dashboard />;
  };

  return (
    <div className="app">
      <aside className={mobile ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-icon">K</div>
          <div>
            <strong>kelassi_moderne</strong>
            <small>Plateforme scolaire</small>
          </div>
          <button className="close" onClick={()=>setMobile(false)}><X/></button>
        </div>

        <nav>
          {menu.map(([name,Icon])=>(
            <button
              key={name}
              className={active===name?'nav-item active':'nav-item'}
              onClick={()=>{setActive(name);setMobile(false)}}
            >
              <Icon size={19}/>
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">BC</div>
            <div>
              <strong>Administrateur</strong>
              <small>Direction</small>
            </div>
          </div>
        </div>
      </aside>

      {mobile && <div className="overlay" onClick={()=>setMobile(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={()=>setMobile(true)}><Menu/></button>
          <div className="search">
            <Search size={18}/>
            <input placeholder="Rechercher un étudiant, cours, devoir..." />
          </div>
          <div className="top-actions">
            <button><Bell size={20}/><span className="notification">3</span></button>
            <div className="top-avatar">BC</div>
          </div>
        </header>

        <section className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">ÉTABLISSEMENT SCOLAIRE</span>
              <h1>{active}</h1>
              <p>Bienvenue sur votre espace de gestion scolaire.</p>
            </div>
            <button className="primary"><Upload size={17}/> Ajouter</button>
          </div>
          {renderContent()}
        </section>
      </main>
    </div>
  )
}

function Dashboard(){
  return <>
    <div className="stats">
      <Stat title="Étudiants" value="1 250" change="+12%" icon={Users}/>
      <Stat title="Enseignants" value="85" change="+4%" icon={GraduationCap}/>
      <Stat title="Cours publiés" value="258" change="+18%" icon={BookOpen}/>
      <Stat title="Moyenne générale" value="14,2/20" change="+0,8" icon={TrendingUp}/>
    </div>

    <div className="grid-two">
      <div className="panel">
        <div className="panel-head">
          <div><h2>Activité récente</h2><p>Dernières actions sur la plateforme</p></div>
          <button className="link">Voir tout</button>
        </div>
        <Activity text="Nouveau cours publié : Algorithmique" time="Il y a 10 min" icon={BookOpen}/>
        <Activity text="32 devoirs ont été remis" time="Il y a 45 min" icon={ClipboardCheck}/>
        <Activity text="Notes de L2 Informatique mises à jour" time="Il y a 2 h" icon={FileText}/>
        <Activity text="Nouvelle annonce publiée" time="Il y a 4 h" icon={Bell}/>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div><h2>Performance scolaire</h2><p>Moyenne générale par niveau</p></div>
        </div>
        <div className="bars">
          <Bar label="L1 Informatique" value="72%" score="14,4"/>
          <Bar label="L2 Informatique" value="78%" score="15,6"/>
          <Bar label="L3 Informatique" value="84%" score="16,8"/>
          <Bar label="Master" value="88%" score="17,6"/>
        </div>
      </div>
    </div>

    <div className="panel">
      <div className="panel-head">
        <div><h2>Étudiants récents</h2><p>Suivi des inscriptions et résultats</p></div>
        <button className="link">Voir tous les étudiants <ChevronRight size={15}/></button>
      </div>
      <StudentTable/>
    </div>
  </>
}

function Students(){
  return <div className="panel">
    <div className="panel-head">
      <div><h2>Gestion des étudiants</h2><p>1 250 étudiants enregistrés</p></div>
      <button className="primary"><Users size={17}/> Nouvel étudiant</button>
    </div>
    <StudentTable/>
  </div>
}

function StudentTable(){
  return <div className="table-wrap"><table>
    <thead><tr><th>Étudiant</th><th>Classe</th><th>Moyenne</th><th>Statut</th></tr></thead>
    <tbody>{students.map(s=><tr key={s[0]}>
      <td><div className="student"><div className="mini-avatar">{s[0].split(' ').map(x=>x[0]).join('')}</div><strong>{s[0]}</strong></div></td>
      <td>{s[1]}</td><td><b>{s[2]}</b></td><td><span className={s[3]==='Active'?'badge green':'badge orange'}>{s[3]}</span></td>
    </tr>)}</tbody>
  </table></div>
}

function Courses(){
  const courses=['Algorithmique','Programmation Web','Bases de données','Réseaux informatiques','Intelligence artificielle','Systèmes d’exploitation'];
  return <div className="cards">
    {courses.map((c,i)=><div className="course-card" key={c}>
      <div className="course-icon"><BookOpen/></div>
      <span className="tag">L2 INFORMATIQUE</span>
      <h3>{c}</h3><p>24 documents • 6 chapitres</p>
      <div className="card-footer"><span>Publié</span><ChevronRight size={18}/></div>
    </div>)}
  </div>
}

function Assignments(){
  return <div className="panel">
    <div className="panel-head"><div><h2>Devoirs en ligne</h2><p>Suivi des travaux des étudiants</p></div><button className="primary"><ClipboardCheck size={17}/> Créer un devoir</button></div>
    <div className="assignment-list">
      {['Projet React — Interface utilisateur','TP Bases de données — SQL','Devoir Algorithmique — Graphes','Exercice Réseaux — TCP/IP'].map((x,i)=>
        <div className="assignment" key={x}><div className="assignment-icon"><FileText/></div><div className="assignment-info"><strong>{x}</strong><span>Classe L2 • Date limite : {20+i} août 2026</span></div><div className="assignment-status"><b>{[28,21,35,17][i]}/{[32,32,40,32][i]}</b><small>rendus</small></div><ChevronRight/></div>
      )}
    </div>
  </div>
}

function Grades(){
  return <div className="grid-two">
    <div className="panel"><div className="panel-head"><div><h2>Calcul automatique</h2><p>Les moyennes sont calculées selon les coefficients</p></div></div>
      <div className="grade-box"><div className="big-score">15,6<span>/20</span></div><div><strong>Jean Martin</strong><p>Moyenne générale — L2 Informatique</p></div></div>
      <div className="grade-row"><span>Contrôle continu <b>30%</b></span><strong>16,5</strong></div>
      <div className="grade-row"><span>Devoirs <b>20%</b></span><strong>15,0</strong></div>
      <div className="grade-row"><span>Examen final <b>50%</b></span><strong>15,8</strong></div>
    </div>
    <div className="panel"><div className="panel-head"><div><h2>Résultats</h2><p>Vue globale de la classe</p></div></div><div className="result-ring">78%<small>Réussite</small></div><div className="result-stats"><span>Étudiants validés <b>31</b></span><span>À rattraper <b>6</b></span><span>Non validés <b>3</b></span></div></div>
  </div>
}

function Teachers(){
  return <div className="cards">
    {['Dr. Alexandre Martin','Mme. Sophie Dubois','M. Patrick Kabila','Dr. Claire Moreau'].map((x,i)=><div className="teacher-card" key={x}><div className="teacher-avatar">{x.split(' ').slice(-1)[0][0]}</div><h3>{x}</h3><p>{['Informatique','Mathématiques','Réseaux','Data Science'][i]}</p><span>{[6,5,4,7][i]} classes</span></div>)}
  </div>
}

function Stat({title,value,change,icon:Icon}){
  return <div className="stat"><div className="stat-icon"><Icon size={21}/></div><div><span>{title}</span><strong>{value}</strong><small>{change} ce mois</small></div></div>
}
function Activity({text,time,icon:Icon}){return <div className="activity"><div className="activity-icon"><Icon size={17}/></div><div><strong>{text}</strong><small>{time}</small></div></div>}
function Bar({label,value,score}){return <div className="bar-row"><div><span>{label}</span><b>{score}/20</b></div><div className="bar"><i style={{width:value}}/></div></div>}

createRoot(document.getElementById('root')).render(<App/>);
JS

cat > src/styles/app.css <<'CSS'
*{box-sizing:border-box}
:root{font-family:Inter,system-ui,-apple-system,sans-serif;color:#172B3A;background:#F5F8FA}
body{margin:0}
button,input{font:inherit}
button{cursor:pointer}
.app{display:flex;min-height:100vh}
.sidebar{width:250px;background:#102A43;color:#DCE8F0;display:flex;flex-direction:column;position:fixed;inset:0 auto 0 0;z-index:20}
.brand{height:82px;padding:20px;display:flex;gap:11px;align-items:center;border-bottom:1px solid rgba(255,255,255,.08)}
.brand-icon{width:40px;height:40px;border-radius:11px;background:#42A5B8;color:white;display:grid;place-items:center;font-weight:800;font-size:20px}
.brand strong{display:block;color:white;font-size:14px}.brand small{display:block;color:#8EA8B8;font-size:10px;margin-top:3px}
nav{padding:18px 12px;flex:1}.nav-item{width:100%;border:0;background:transparent;color:#9DB1BF;padding:12px 14px;display:flex;gap:12px;align-items:center;border-radius:9px;margin-bottom:5px;text-align:left}.nav-item:hover,.nav-item.active{background:#1B4561;color:white}.nav-item.active{box-shadow:inset 3px 0 #42A5B8}
.sidebar-bottom{padding:15px;border-top:1px solid rgba(255,255,255,.08)}.profile{display:flex;gap:10px;align-items:center}.avatar,.top-avatar,.mini-avatar{display:grid;place-items:center;border-radius:50%;font-weight:700}.avatar{width:34px;height:34px;background:#42A5B8;color:white;font-size:11px}.profile strong{display:block;color:white;font-size:11px}.profile small{font-size:10px;color:#8EA8B8}
.main{margin-left:250px;width:calc(100% - 250px)}
.topbar{height:70px;background:white;border-bottom:1px solid #E3EBEF;display:flex;align-items:center;justify-content:space-between;padding:0 30px;position:sticky;top:0;z-index:10}.search{display:flex;align-items:center;gap:10px;color:#8AA0AD;width:460px}.search input{border:0;outline:0;width:100%;font-size:12px}.top-actions{display:flex;align-items:center;gap:20px}.top-actions button{position:relative;border:0;background:transparent;color:#587080}.notification{position:absolute;top:-5px;right:-4px;background:#E85D5D;color:white;border-radius:10px;font-size:8px;padding:2px 5px}.top-avatar{width:34px;height:34px;background:#DCEEF2;color:#1F6072;font-size:11px}
.content{padding:32px;max-width:1500px;margin:auto}.page-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:27px}.eyebrow{font-size:9px;letter-spacing:1.5px;color:#42A5B8;font-weight:800}.page-heading h1{font-size:28px;margin:7px 0 4px;color:#102A43}.page-heading p{margin:0;color:#78909C;font-size:12px}
.primary{border:0;background:#1F6F8B;color:white;padding:10px 15px;border-radius:8px;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700}.primary:hover{background:#185B73}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:17px;margin-bottom:20px}.stat{background:white;border:1px solid #E4ECEF;border-radius:11px;padding:20px;display:flex;gap:15px;align-items:center}.stat-icon{width:43px;height:43px;background:#EAF5F7;color:#28758A;border-radius:10px;display:grid;place-items:center}.stat span{display:block;font-size:10px;color:#8296A2}.stat strong{display:block;font-size:23px;color:#102A43;margin:3px 0}.stat small{font-size:9px;color:#36A27C}
.grid-two{display:grid;grid-template-columns:1.25fr 1fr;gap:20px;margin-bottom:20px}.panel{background:white;border:1px solid #E4ECEF;border-radius:11px;padding:22px;margin-bottom:20px}.panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.panel h2{font-size:15px;margin:0 0 5px;color:#17354A}.panel-head p{margin:0;font-size:10px;color:#8A9BA5}.link{background:none;border:0;color:#2A7D94;font-size:10px;font-weight:700;display:flex;align-items:center;gap:4px}
.activity{display:flex;gap:12px;padding:13px 0;border-bottom:1px solid #EEF2F4}.activity:last-child{border:0}.activity-icon{width:32px;height:32px;border-radius:8px;background:#F0F6F8;color:#2A7D94;display:grid;place-items:center}.activity strong{font-size:10px;display:block;color:#314C5D}.activity small{display:block;color:#9AAAB3;font-size:9px;margin-top:4px}
.bars{padding:5px 0}.bar-row{margin-bottom:17px}.bar-row>div:first-child{display:flex;justify-content:space-between;font-size:10px;margin-bottom:7px;color:#627986}.bar-row b{color:#1F6F8B}.bar{height:7px;background:#EDF2F4;border-radius:5px;overflow:hidden}.bar i{display:block;height:100%;background:#42A5B8;border-radius:5px}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:600px}th{text-align:left;font-size:9px;color:#92A1AA;text-transform:uppercase;letter-spacing:.5px;padding:10px;border-bottom:1px solid #E8EEF0}td{font-size:10px;padding:13px 10px;border-bottom:1px solid #F0F3F4;color:#536B78}.student{display:flex;align-items:center;gap:9px;color:#294555}.mini-avatar{width:29px;height:29px;background:#EAF5F7;color:#2B7186;font-size:9px}.badge{padding:4px 8px;border-radius:12px;font-size:8px;font-weight:700}.green{background:#E8F7F0;color:#2B9B6E}.orange{background:#FFF3E4;color:#C77B23}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.course-card,.teacher-card{background:white;border:1px solid #E4ECEF;border-radius:11px;padding:21px}.course-icon{width:43px;height:43px;background:#EAF5F7;color:#28758A;border-radius:10px;display:grid;place-items:center;margin-bottom:18px}.tag{font-size:8px;color:#42A5B8;font-weight:800;letter-spacing:.6px}.course-card h3,.teacher-card h3{font-size:14px;color:#17354A;margin:8px 0}.course-card p,.teacher-card p{font-size:10px;color:#899BA5}.card-footer{border-top:1px solid #EDF1F3;margin-top:18px;padding-top:13px;display:flex;justify-content:space-between;color:#2C8A6A;font-size:9px}.teacher-card{text-align:center}.teacher-avatar{width:58px;height:58px;margin:auto;border-radius:50%;display:grid;place-items:center;background:#DDEFF3;color:#24677C;font-size:21px;font-weight:800}.teacher-card span{font-size:9px;color:#80939E}
.assignment{display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid #EEF2F4}.assignment-icon{width:38px;height:38px;background:#EEF6F8;color:#28758A;border-radius:9px;display:grid;place-items:center}.assignment-info{flex:1}.assignment-info strong{display:block;font-size:11px;color:#294555}.assignment-info span{display:block;font-size:9px;color:#93A1AA;margin-top:5px}.assignment-status{text-align:right}.assignment-status b{display:block;font-size:12px;color:#1F6F8B}.assignment-status small{font-size:8px;color:#9AA8B0}
.grade-box{background:#F1F8FA;border-radius:10px;padding:20px;display:flex;align-items:center;gap:20px;margin-bottom:15px}.big-score{font-size:34px;font-weight:800;color:#1F6F8B}.big-score span{font-size:12px;color:#8296A2}.grade-box strong{font-size:12px}.grade-box p{font-size:9px;color:#8A9BA5}.grade-row{display:flex;justify-content:space-between;padding:13px 5px;border-bottom:1px solid #EEF2F4;font-size:10px;color:#657985}.grade-row b{font-size:8px;background:#EEF4F6;padding:3px 6px;border-radius:8px;margin-left:6px}.grade-row strong{color:#1F6F8B}.result-ring{width:140px;height:140px;border-radius:50%;border:13px solid #DCEFF2;border-top-color:#2D8499;border-right-color:#42A5B8;margin:25px auto;display:grid;place-items:center;font-size:25px;font-weight:800;color:#1F6072}.result-ring small{display:block;font-size:9px;color:#81939C;margin-top:-45px}.result-stats span{display:flex;justify-content:space-between;padding:9px;border-bottom:1px solid #EEF2F4;font-size:10px;color:#718590}.result-stats b{color:#1F6F8B}
.mobile-menu,.close,.overlay{display:none}
@media(max-width:950px){.stats{grid-template-columns:repeat(2,1fr)}.cards{grid-template-columns:repeat(2,1fr)}.grid-two{grid-template-columns:1fr}}
@media(max-width:700px){.sidebar{transform:translateX(-100%);transition:.25s}.sidebar.open{transform:translateX(0)}.main{margin-left:0;width:100%}.mobile-menu{display:block;border:0;background:none;color:#2A6075}.close{display:block;margin-left:auto;background:none;border:0;color:white}.overlay{display:block;position:fixed;inset:0;background:#102A43AA;z-index:15}.topbar{padding:0 16px}.search{width:auto;flex:1;margin-left:12px}.content{padding:20px 14px}.page-heading{align-items:flex-start}.page-heading h1{font-size:23px}.page-heading .primary{display:none}.stats{grid-template-columns:1fr 1fr;gap:10px}.stat{padding:14px;gap:9px}.stat strong{font-size:18px}.stat-icon{width:36px;height:36px}.cards{grid-template-columns:1fr}.panel{padding:15px}.grid-two{gap:0}.top-actions{gap:10px}}
@media(max-width:430px){.stats{grid-template-columns:1fr}.search input{font-size:10px}.page-heading p{font-size:10px}.panel-head{align-items:flex-start;gap:10px}.link{font-size:9px}}
CSS

cat > vite.config.js <<'JS'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({plugins:[react()]})
JS

echo ""
echo "=========================================="
echo "  kelassi_moderne créé avec succès !"
echo "=========================================="
echo ""
echo "Installation des dépendances..."
npm install
echo ""
echo "Lancement du prototype..."
echo "Ouvre ensuite : http://localhost:5173"
npm run dev

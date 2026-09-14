const LAT = 38.9619998275862;
const LON = 38.7569432758621;
const ELEVATION_M = 855;
const START = '2026-09-01';
const END = '2026-09-07';

const compact = (v:string) => v.replaceAll('-', '');
const finite = (v:unknown):number|null => { const n=Number(v); return Number.isFinite(n)&&n>-900?n:null; };
const round = (v:number|null,d=3) => v==null||!Number.isFinite(v)?null:Number(v.toFixed(d));
const mean = (a:Array<number|null>) => { const v=a.filter((x):x is number=>x!=null&&Number.isFinite(x)); return v.length?v.reduce((s,x)=>s+x,0)/v.length:null; };
const meanAbs = (a:Array<number|null>) => mean(a.map(v=>v==null?null:Math.abs(v)));
const satVp = (t:number) => 0.6108*Math.exp(17.27*t/(t+237.3));
const wind10to2 = (u:number) => u*4.87/Math.log(67.8*10-5.42);

function dayOfYear(iso:string){ const d=new Date(`${iso}T00:00:00Z`), y=new Date(Date.UTC(d.getUTCFullYear(),0,0)); return Math.floor((d.getTime()-y.getTime())/86400000); }
function fao56Et0(i:{date:string;tmax:number;tmin:number;dew:number;wind2:number;solar:number}){
  const tm=(i.tmax+i.tmin)/2, es=(satVp(i.tmax)+satVp(i.tmin))/2, ea=satVp(i.dew), delta=4098*satVp(tm)/((tm+237.3)**2);
  const p=101.3*(((293-.0065*ELEVATION_M)/293)**5.26), gamma=.000665*p, j=dayOfYear(i.date), phi=LAT*Math.PI/180;
  const dr=1+.033*Math.cos(2*Math.PI*j/365), sd=.409*Math.sin(2*Math.PI*j/365-1.39), ws=Math.acos(Math.max(-1,Math.min(1,-Math.tan(phi)*Math.tan(sd))));
  const ra=24*60/Math.PI*.082*dr*(ws*Math.sin(phi)*Math.sin(sd)+Math.cos(phi)*Math.cos(sd)*Math.sin(ws));
  const rso=(.75+2e-5*ELEVATION_M)*ra, rns=.77*i.solar, sigma=4.903e-9, tk1=i.tmax+273.16, tk2=i.tmin+273.16;
  const cloud=rso>0?Math.max(.05,Math.min(1,i.solar/rso)):.05;
  const rnl=sigma*((tk1**4+tk2**4)/2)*(.34-.14*Math.sqrt(Math.max(0,ea)))*(1.35*cloud-.35), rn=rns-rnl;
  return Math.max(0,(.408*delta*rn+gamma*(900/(tm+273))*i.wind2*(es-ea))/(delta+gamma*(1+.34*i.wind2)));
}

async function fetchJson(url:string){ const r=await fetch(url,{headers:{'User-Agent':'TarlaPusula-ET0-Diagnostics/1.0'}}); if(!r.ok) throw new Error(`HTTP ${r.status} · ${new URL(url).hostname}`); return r.json(); }

function nasaLstDay(p:any,date:string){
  const k=compact(date), v={tmax:finite(p?.T2M_MAX?.[k]),tmin:finite(p?.T2M_MIN?.[k]),dew:finite(p?.T2MDEW?.[k]),wind2:finite(p?.WS2M?.[k]),solar:finite(p?.ALLSKY_SFC_SW_DWN?.[k])};
  if(Object.values(v).some(x=>x==null)) return null;
  const met=v as {tmax:number;tmin:number;dew:number;wind2:number;solar:number};
  return {...met,et0:fao56Et0({date,...met})};
}

function nasaHourlyUtcDay(p:any,date:string){
  const prefix=compact(date), keys=Object.keys(p?.T2M??{}).filter(k=>k.startsWith(prefix));
  const t=keys.map(k=>finite(p?.T2M?.[k])).filter((v):v is number=>v!=null);
  const dew=keys.map(k=>finite(p?.T2MDEW?.[k])).filter((v):v is number=>v!=null);
  const wind=keys.map(k=>finite(p?.WS2M?.[k])).filter((v):v is number=>v!=null);
  const solar=keys.map(k=>finite(p?.ALLSKY_SFC_SW_DWN?.[k])).filter((v):v is number=>v!=null);
  if(t.length!==24||dew.length!==24||wind.length!==24||solar.length!==24) return null;
  const met={tmax:Math.max(...t),tmin:Math.min(...t),dew:mean(dew)!,wind2:mean(wind)!,solar:solar.reduce((s,x)=>s+x,0)*.0036};
  return {...met,et0:fao56Et0({date,...met})};
}

function openDay(o:any,date:string){
  const di=(o?.daily?.time??[]).indexOf(date); if(di<0) return null;
  const idx:number[]=[]; (o?.hourly?.time??[]).forEach((t:unknown,i:number)=>{if(String(t).startsWith(date))idx.push(i)});
  const dew=idx.map(i=>finite(o?.hourly?.dew_point_2m?.[i])).filter((v):v is number=>v!=null), wind10=idx.map(i=>finite(o?.hourly?.wind_speed_10m?.[i])).filter((v):v is number=>v!=null), rad=idx.map(i=>finite(o?.hourly?.shortwave_radiation?.[i])).filter((v):v is number=>v!=null);
  const published=finite(o?.daily?.et0_fao_evapotranspiration?.[di]), tmax=finite(o?.daily?.temperature_2m_max?.[di]), tmin=finite(o?.daily?.temperature_2m_min?.[di]);
  if(published==null||tmax==null||tmin==null||dew.length!==24||wind10.length!==24||rad.length!==24) return {published,incomplete:true};
  const met={tmax,tmin,dew:mean(dew)!,wind2:wind10to2(mean(wind10)!),solar:rad.reduce((s,x)=>s+x,0)*.0036};
  return {...met,published,reconstructed:fao56Et0({date,...met}),incomplete:false};
}

function dominantDriver(nasa:any,open:any,date:string){
  if(!nasa||!open||open.incomplete)return null;
  const base=nasa.et0;
  const c=[['wind',fao56Et0({date,...nasa,wind2:open.wind2})],['temperature',fao56Et0({date,...nasa,tmax:open.tmax,tmin:open.tmin})],['humidity_dewpoint',fao56Et0({date,...nasa,dew:open.dew})],['solar_radiation',fao56Et0({date,...nasa,solar:open.solar})]]
    .map(([name,value])=>({name:String(name),deltaMm:Number(value)-base})).sort((a,b)=>Math.abs(b.deltaMm)-Math.abs(a.deltaMm));
  return c[0];
}

export default async function handler(_req:any,res:any){
  res.setHeader('Cache-Control','no-store');
  try{
    const dailyLst=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,T2MDEW,WS2M,ALLSKY_SFC_SW_DWN&community=AG&longitude=${LON}&latitude=${LAT}&start=${compact(START)}&end=${compact(END)}&format=JSON&time-standard=LST`;
    const hourlyUtc=`https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,T2MDEW,WS2M,ALLSKY_SFC_SW_DWN&community=AG&longitude=${LON}&latitude=${LAT}&start=${compact(START)}&end=${compact(END)}&format=JSON&time-standard=UTC`;
    const common=`latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration&hourly=dew_point_2m,wind_speed_10m,shortwave_radiation&start_date=${START}&end_date=${END}&wind_speed_unit=ms`;
    const [nasaLstRaw,nasaHourlyUtcRaw,openUtcRaw,openIstRaw]=await Promise.all([
      fetchJson(dailyLst),fetchJson(hourlyUtc),fetchJson(`https://archive-api.open-meteo.com/v1/archive?${common}&timezone=UTC`),fetchJson(`https://archive-api.open-meteo.com/v1/archive?${common}&timezone=Europe%2FIstanbul`)
    ]);
    const dates:string[]=[]; for(let d=new Date(`${START}T00:00:00Z`);d<=new Date(`${END}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+1)) dates.push(d.toISOString().slice(0,10));
    const pLst=nasaLstRaw?.properties?.parameter??{}, pUtc=nasaHourlyUtcRaw?.properties?.parameter??{};
    const rows=dates.map(date=>{
      const nl=nasaLstDay(pLst,date), nu=nasaHourlyUtcDay(pUtc,date), ou=openDay(openUtcRaw,date), oi=openDay(openIstRaw,date), drv=dominantDriver(nu,ou,date);
      const nasaBoundary=nl&&nu?nu.et0-nl.et0:null, sourceDelta=nu&&ou?.published!=null?ou.published-nu.et0:null, sourcePct=sourceDelta!=null&&nu?.et0?sourceDelta/nu.et0*100:null;
      const openBoundary=ou?.published!=null&&oi?.published!=null?oi.published-ou.published:null, reconGap=ou?.published!=null&&ou?.reconstructed!=null?ou.published-ou.reconstructed:null;
      return {date,nasaLstEt0Mm:round(nl?.et0??null),nasaUtcHourlyEt0Mm:round(nu?.et0??null),openUtcPublishedEt0Mm:round(ou?.published??null),openUtcReconstructedEt0Mm:round(ou?.reconstructed??null),openIstanbulPublishedEt0Mm:round(oi?.published??null),nasaLstToUtcDeltaMm:round(nasaBoundary),openMinusNasaUtcMm:round(sourceDelta),openMinusNasaUtcPct:round(sourcePct,1),openIstanbulMinusUtcMm:round(openBoundary),openPublishedMinusReconstructedMm:round(reconGap),dominantInputDriver:drv?{name:drv.name,deltaMm:round(drv.deltaMm)}:null};
    });
    const comparable=rows.filter(r=>r.nasaLstEt0Mm!=null&&r.nasaUtcHourlyEt0Mm!=null&&r.openUtcPublishedEt0Mm!=null);
    const counts=new Map<string,number>(); comparable.forEach(r=>{if(r.dominantInputDriver?.name)counts.set(r.dominantInputDriver.name,(counts.get(r.dominantInputDriver.name)??0)+1)}); const top=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]??null;
    res.status(200).json({
      scope:{field:'ŞENO',crop:'Badem',start:START,end:END,latitude:LAT,longitude:LON,elevationM:ELEVATION_M},
      method:{nasaLst:'POWER daily LST',nasaUtc:'POWER hourly UTC aggregated to calendar UTC day',nasaHourlySolarConversion:'sum hourly ALLSKY_SFC_SW_DWN × 0.0036 => MJ/m²/day',openUtc:'Open-Meteo archive daily UTC'},
      note:'Preview-only diagnostics. Production irrigation authority is unchanged.',
      summary:{comparableDays:comparable.length,nasaLstEt0MeanMm:round(mean(comparable.map(r=>r.nasaLstEt0Mm))),nasaUtcHourlyEt0MeanMm:round(mean(comparable.map(r=>r.nasaUtcHourlyEt0Mm))),openUtcPublishedEt0MeanMm:round(mean(comparable.map(r=>r.openUtcPublishedEt0Mm))),meanAbsNasaLstToUtcDeltaMm:round(meanAbs(comparable.map(r=>r.nasaLstToUtcDeltaMm))),meanAbsSourceDeltaMm:round(meanAbs(comparable.map(r=>r.openMinusNasaUtcMm))),meanSignedSourceDeltaPct:round(mean(comparable.map(r=>r.openMinusNasaUtcPct)),1),openHigherThanNasaUtcDays:comparable.filter(r=>(r.openMinusNasaUtcMm??0)>0).length,meanAbsOpenIstanbulToUtcDeltaMm:round(meanAbs(comparable.map(r=>r.openIstanbulMinusUtcMm))),meanAbsOpenPublishedToReconstructedDeltaMm:round(meanAbs(comparable.map(r=>r.openPublishedMinusReconstructedMm))),dominantDriver:top?{name:top[0],days:top[1]}:null},
      days:rows
    });
  }catch(error){res.status(500).json({error:error instanceof Error?error.message:String(error)});}
}

const LAT=38.9619998275862;
const LON=38.7569432758621;
const START='20260901';
const END='20260907';

async function getDaily(standard:string){
  const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,T2MDEW,WS2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN&community=AG&longitude=${LON}&latitude=${LAT}&start=${START}&end=${END}&format=JSON&time-standard=${standard}`;
  const r=await fetch(url,{headers:{'User-Agent':'TarlaPusula-ET0-Diagnostics/1.0'}});
  const text=await r.text();
  if(!r.ok) throw new Error(`${standard} daily HTTP ${r.status}: ${text.slice(0,300)}`);
  return JSON.parse(text);
}

async function getHourlyUtc(){
  const url=`https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,T2MDEW,WS2M,ALLSKY_SFC_SW_DWN&community=AG&longitude=${LON}&latitude=${LAT}&start=${START}&end=${END}&format=JSON&time-standard=UTC`;
  const r=await fetch(url,{headers:{'User-Agent':'TarlaPusula-ET0-Diagnostics/1.0'}});
  const text=await r.text();
  if(!r.ok) throw new Error(`UTC hourly HTTP ${r.status}: ${text.slice(0,300)}`);
  return JSON.parse(text);
}

function inspectDaily(raw:any){
  const p=raw?.properties?.parameter ?? {};
  const sample:any={};
  for(const name of ['T2M_MAX','T2M_MIN','T2MDEW','WS2M','PRECTOTCORR','ALLSKY_SFC_SW_DWN']){
    const series=p?.[name];
    sample[name]={exists:Boolean(series),dates:series?Object.keys(series):[],values:series??null};
  }
  return {keys:Object.keys(p),sample,header:raw?.header??null,parameters:raw?.parameters??null,geometry:raw?.geometry??null};
}

function inspectHourly(raw:any){
  const p=raw?.properties?.parameter ?? {};
  const sample:any={};
  for(const name of ['T2M','T2MDEW','WS2M','ALLSKY_SFC_SW_DWN']){
    const series=p?.[name]??{};
    sample[name]={exists:Boolean(p?.[name]),count:Object.keys(series).length,first:Object.fromEntries(Object.entries(series).slice(0,30))};
  }
  return {keys:Object.keys(p),sample,header:raw?.header??null,parameters:raw?.parameters??null,geometry:raw?.geometry??null};
}

export default async function handler(_req:any,res:any){
  res.setHeader('Cache-Control','no-store');
  try{
    const [lst,utc,hourlyUtc]=await Promise.all([getDaily('LST'),getDaily('UTC'),getHourlyUtc()]);
    res.status(200).json({lst:inspectDaily(lst),utc:inspectDaily(utc),hourlyUtc:inspectHourly(hourlyUtc)});
  }catch(error){
    res.status(500).json({error:error instanceof Error?error.message:String(error)});
  }
}

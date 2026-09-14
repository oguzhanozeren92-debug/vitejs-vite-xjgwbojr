const LAT=38.9619998275862;
const LON=38.7569432758621;
const START='20260901';
const END='20260907';

async function get(standard:string){
  const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,T2MDEW,WS2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN&community=AG&longitude=${LON}&latitude=${LAT}&start=${START}&end=${END}&format=JSON&time-standard=${standard}`;
  const r=await fetch(url,{headers:{'User-Agent':'TarlaPusula-ET0-Diagnostics/1.0'}});
  const text=await r.text();
  if(!r.ok) throw new Error(`${standard} HTTP ${r.status}: ${text.slice(0,300)}`);
  return JSON.parse(text);
}

function inspect(raw:any){
  const p=raw?.properties?.parameter ?? {};
  const keys=Object.keys(p);
  const sample:any={};
  for(const name of ['T2M_MAX','T2M_MIN','T2MDEW','WS2M','PRECTOTCORR','ALLSKY_SFC_SW_DWN']){
    const series=p?.[name];
    sample[name]={exists:Boolean(series),dates:series?Object.keys(series):[],values:series??null};
  }
  return {keys,sample,header:raw?.header??null,geometry:raw?.geometry??null};
}

export default async function handler(_req:any,res:any){
  res.setHeader('Cache-Control','no-store');
  try{
    const [lst,utc]=await Promise.all([get('LST'),get('UTC')]);
    res.status(200).json({lst:inspect(lst),utc:inspect(utc)});
  }catch(error){
    res.status(500).json({error:error instanceof Error?error.message:String(error)});
  }
}

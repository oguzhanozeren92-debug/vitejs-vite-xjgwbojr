import { useEffect, useRef, useState } from 'react';
import { Check, GitCompareArrows, Image as ImageIcon, X } from 'lucide-react';
import { getSatelliteHistoryPreview } from '../services/satelliteHistory';
import './SatelliteHistorySheet.css';

type Props = { open:boolean; dates:string[]; loading:boolean; error:string|null; fieldName:string; selectedDate?:string|null; onSelect:(date:string|null)=>void; onClose:()=>void };
function formatDate(date:string){const parts=date.split('-');return parts.length===3?`${parts[2]}.${parts[1]}.${parts[0]}`:date}

export default function SatelliteHistorySheet(props:Props){
  const dialog=useRef<HTMLDialogElement>(null);
  const [compareMode,setCompareMode]=useState(false);
  const [compareDates,setCompareDates]=useState<string[]>([]);
  const [slider,setSlider]=useState(50);
  const currentDate=props.dates[0]??null;
  const afterDate=compareDates[0]??null;
  const beforeDate=compareDates[1]??null;
  const afterImage=afterDate?getSatelliteHistoryPreview(afterDate):null;
  const beforeImage=beforeDate?getSatelliteHistoryPreview(beforeDate):null;

  useEffect(()=>{const node=dialog.current;if(!node)return;if(props.open){if(!node.open)node.showModal()}else if(node.open)node.close()},[props.open]);
  useEffect(()=>{if(!props.open){setCompareMode(false);setCompareDates([]);setSlider(50)}},[props.open]);

  const requestPreview=(date:string)=>window.dispatchEvent(new CustomEvent('tp:satellite-history-preview-request',{detail:{date}}));
  const toggleCompareDate=(date:string)=>{
    setCompareDates(current=>current.includes(date)?current.filter(item=>item!==date):current.length>=2?[current[1],date]:[...current,date]);
    requestPreview(date);
  };

  return <dialog ref={dialog} className="tp-satellite-history" onCancel={e=>{e.preventDefault();props.onClose()}} aria-labelledby="tp-satellite-history-title" onClick={e=>{if(e.target===e.currentTarget)props.onClose()}}>
    <div className="tp-satellite-history-handle" aria-hidden="true"/>
    <header><div><small>{props.fieldName}</small><h2 id="tp-satellite-history-title">Uydu Geçmişi</h2><span className="tp-satellite-history-current">Güncel ölçüm: {currentDate?formatDate(currentDate):'yükleniyor'}</span></div><button type="button" className="tp-satellite-history-close" onClick={props.onClose} aria-label="Kapat"><X size={21}/></button></header>
    <div className="tp-satellite-history-modebar"><p className="tp-satellite-history-intro">Son 180 gündeki uygun Sentinel-2 çekimleri. Sağa kaydırdıkça daha eski tarihlere gidersin.</p><button type="button" className={`tp-satellite-compare-toggle ${compareMode?'active':''}`} onClick={()=>{setCompareMode(v=>!v);setCompareDates([]);setSlider(50)}}><GitCompareArrows size={15}/>{compareMode?'Karşılaştırmayı kapat':'İki tarihi karşılaştır'}</button></div>

    {compareMode&&compareDates.length===2?<section className="tp-satellite-compare" aria-label="Uydu görüntüsü önce sonra karşılaştırması"><div className="tp-satellite-compare-head"><span><b>ÖNCE</b>{beforeDate?formatDate(beforeDate):'—'}</span><span><b>SONRA</b>{afterDate?formatDate(afterDate):'—'}</span></div>{beforeImage&&afterImage?<div className="tp-satellite-compare-stage"><img src={beforeImage} alt={`${formatDate(beforeDate!)} NDVI`} draggable={false}/><div className="tp-satellite-compare-after" style={{clipPath:`inset(0 0 0 ${slider}%)`}}><img src={afterImage} alt={`${formatDate(afterDate!)} NDVI`} draggable={false}/></div><i className="tp-satellite-compare-line" style={{left:`${slider}%`}} aria-hidden="true"/><input type="range" min="0" max="100" value={slider} onChange={e=>setSlider(Number(e.target.value))} aria-label="Önce sonra karşılaştırma sürgüsü"/></div>:<div className="tp-satellite-compare-wait"><span/><strong>Gerçek uydu görüntüleri hazırlanıyor…</strong></div>}<p>Ortadaki sürgüyü sağa-sola çekerek aynı tarlanın iki gerçek NDVI görüntüsünü karşılaştır.</p></section>:compareMode?<div className="tp-satellite-compare-prompt"><GitCompareArrows size={18}/><strong>Karşılaştırmak için iki tarih seç</strong><span>{compareDates.length}/2 seçildi</span></div>:null}

    {props.error?<p className="tp-satellite-history-error" role="alert">{props.error}</p>:null}
    {props.loading&&!props.dates.length?<div className="tp-satellite-history-loading" role="status"><span/><strong>Uydu arşivi hazırlanıyor…</strong></div>:null}
    {!props.loading&&!props.error&&!props.dates.length?<div className="tp-satellite-history-empty"><ImageIcon size={25}/><strong>Uygun çekim bulunamadı</strong><p>Bulut filtresine uyan Sentinel-2 ölçümü bu dönemde bulunamadı.</p></div>:null}
    {props.dates.length?<div className="tp-satellite-history-gallery" aria-label="Uydu görüntüsü tarihleri">{props.dates.map((date,index)=>{const preview=getSatelliteHistoryPreview(date);const isCurrent=index===0;const isSelected=compareMode?compareDates.includes(date):(props.selectedDate?props.selectedDate===date:isCurrent);return <button type="button" key={date} className={`tp-satellite-history-card ${isSelected?'selected':''} ${compareMode?'compare-mode':''}`} aria-pressed={isSelected} disabled={props.loading} onClick={()=>compareMode?toggleCompareDate(date):props.onSelect(isCurrent?null:date)}><span className="tp-satellite-history-thumb">{preview?<img src={preview} alt={`${formatDate(date)} NDVI önizlemesi`} draggable={false}/>:<span className="tp-satellite-history-thumb-loading" aria-hidden="true"><ImageIcon size={20}/></span>}{isCurrent?<em>Güncel</em>:null}{isSelected?<i aria-hidden="true"><Check size={13}/></i>:null}</span><span className="tp-satellite-history-card-copy"><strong>{isCurrent?'Son ölçüm':formatDate(date)}</strong><small>{compareMode?(isSelected?'Karşılaştırmaya eklendi':'Karşılaştırmak için seç'):(isCurrent?formatDate(date):'Sentinel-2 · NDVI')}</small></span></button>})}</div>:null}
  </dialog>;
}

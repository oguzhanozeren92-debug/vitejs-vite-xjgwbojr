import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import HomeMapSection from './HomeMapSection';
import {
  HOME_CLIMATE_DEPTH_LABELS,
  HOME_CLIMATE_LAYER_LABELS,
  HOME_SOIL_DEPTH_LABELS,
  HOME_SOIL_PROPERTY_LABELS,
  type HomeClimateDepth,
  type HomeClimateLayer,
  type HomeLayer,
  type HomeSoilDepth,
  type HomeSoilProperty,
} from '../HomeMapEngine';

type HomeMapSectionMapFirstProps = Record<string, any>;

type LayerOption = {
  id: HomeLayer;
  label: string;
  shortLabel: string;
  hint: string;
};

const LAYERS: LayerOption[] = [
  {
    id: 'vegetation',
    label: 'Bitki Sağlığı',
    shortLabel: 'Sağlık',
    hint: 'NDVI ve bitki gelişimi',
  },
  {
    id: 'radar-vv',
    label: 'Nemli Alanlar',
    shortLabel: 'Nem',
    hint: 'Radar yüzey nem sinyali',
  },
  {
    id: 'radar-vh',
    label: 'Yüzey & Bitki Farkı',
    shortLabel: 'Yüzey',
    hint: 'Radar bitki/yüzey ayrımı',
  },
  {
    id: 'radar-water',
    label: 'Su Birikimi Riski',
    shortLabel: 'Su',
    hint: 'Göllenme ve su adayı alanlar',
  },
  {
    id: 'soil',
    label: 'Toprak',
    shortLabel: 'Toprak',
    hint: 'SoilGrids özellikleri ve derinlik',
  },
  {
    id: 'climate',
    label: 'İklim',
    shortLabel: 'İklim',
    hint: 'Nem, sıcaklık ve iklim sinyalleri',
  },
  {
    id: 'surface-temperature',
    label: 'Yüzey Sıcaklığı',
    shortLabel: 'Sıcaklık',
    hint: 'Yüzeye yakın sıcaklık',
  },
  {
    id: 'evapotranspiration',
    label: 'Su İhtiyacı',
    shortLabel: 'ET₀',
    hint: 'Referans evapotranspirasyon',
  },
  {
    id: 'rainfall-history',
    label: 'Yağış Geçmişi',
    shortLabel: 'Yağış',
    hint: 'Son dönem toplam yağış',
  },
];

const CSS = String.raw`
.tp-map-first-shell{
  position:relative;
}

/* =========================================================
   MAP-FIRST V2 — DAHA FERAH, ÇAKIŞMASIZ
   ========================================================= */
.tp-map-first-shell .tp-home-field{
  overflow:hidden!important;
}

.tp-map-first-shell .tp-ref-map-title,
.tp-map-first-shell .tp-map-section-heading{
  display:none!important;
}

/* Başlık alanı artık yalnızca tarla seçimi + 2 küçük aksiyon. */
.tp-map-first-shell .tp-field-head{
  min-height:54px!important;
  display:block!important;
  padding:6px 9px!important;
  border-bottom:1px solid rgba(30,58,36,.52)!important;
  background:linear-gradient(180deg,rgba(3,12,6,.96),rgba(2,8,4,.94))!important;
}

.tp-map-first-shell .tp-field-head::after{
  display:none!important;
}

.tp-map-first-shell .tp-field-head::before{
  opacity:.05!important;
}

.tp-map-first-shell .tp-field-toolbar{
  width:100%!important;
  max-width:none!important;
  display:grid!important;
  grid-template-columns:40px minmax(0,1fr) 40px 40px!important;
  gap:6px!important;
  align-items:center!important;
  margin:0!important;
}

.tp-map-first-shell .tp-field-select-wrap{
  min-width:0!important;
}

.tp-map-first-shell .tp-field-select-wrap>small{
  display:none!important;
}

.tp-map-first-shell .tp-field-select-box{
  width:100%!important;
  min-height:40px!important;
  height:40px!important;
  border-radius:11px!important;
  background:rgba(3,13,7,.70)!important;
  border-color:rgba(82,113,90,.20)!important;
  box-shadow:none!important;
}

.tp-map-first-shell .tp-field-pin{
  opacity:.68!important;
}

.tp-map-first-shell .tp-field-select{
  height:38px!important;
  min-height:38px!important;
  font-size:10.5px!important;
}

.tp-map-first-shell .tp-field-toolbar .tp-add-field-3d{
  position:static!important;
  width:40px!important;
  height:40px!important;
  min-width:40px!important;
  min-height:40px!important;
  border-radius:11px!important;
  border-color:rgba(82,113,90,.20)!important;
  background:rgba(3,13,7,.70)!important;
  box-shadow:none!important;
}

.tp-map-first-shell .tp-field-toolbar .tp-add-field-3d:hover{
  background:rgba(7,25,13,.82)!important;
  border-color:rgba(101,142,111,.32)!important;
}

.tp-mf-operation-toolbar{
  width:40px!important;
  height:40px!important;
  min-width:40px!important;
  min-height:40px!important;
  display:grid!important;
  place-items:center!important;
  padding:0!important;
  order:-1!important;
  border:1px solid rgba(82,113,90,.20)!important;
  border-radius:11px!important;
  background:rgba(3,13,7,.70)!important;
  color:rgba(213,247,223,.92)!important;
  box-shadow:none!important;
  cursor:pointer!important;
  font-size:18px!important;
  line-height:1!important;
}

.tp-mf-operation-toolbar:hover{
  background:rgba(7,25,13,.82)!important;
  border-color:rgba(34,197,94,.30)!important;
  box-shadow:0 0 16px rgba(34,197,94,.07)!important;
}

.tp-mf-operation-toolbar:active{
  transform:translateY(1px);
}

/* Eski üst katman sekmeleri tamamen kalkıyor. */
.tp-map-first-shell .tp-map-shortcut-stack,
.tp-map-first-shell .tp-layer-subbar,
.tp-map-first-shell .tp-soil-popover{
  display:none!important;
}

/* =========================================================
   HARİTA GERÇEKTEN ALANI DOLDURSUN
   ========================================================= */
.tp-map-first-shell .tp-map-stage{
  height:470px!important;
  min-height:470px!important;
  overflow:hidden!important;
  border-top:0!important;
  background:#020804!important;
}

/* HomeInlineLayerMap inline height=390 gelse bile stage'i tamamen doldur. */
.tp-map-first-shell .tp-map-stage>.tp-real-home-map{
  height:100%!important;
  min-height:100%!important;
}

.tp-map-first-shell .tp-real-home-map,
.tp-map-first-shell .tp-real-home-map-canvas,
.tp-map-first-shell .tp-real-home-map .maplibregl-map,
.tp-map-first-shell .tp-real-home-map .maplibregl-canvas-container{
  height:100%!important;
}

/* Eski veri kartları artık alan kaplamasın. */
.tp-map-first-shell .tp-real-home-badge,
.tp-map-first-shell .tp-map-data-badge,
.tp-map-first-shell .tp-ndvi-legend-card{
  display:none!important;
}

/* Sağ harita araçları, katman düğmesinin altında tek hat. */
.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-top-right{
  top:55px!important;
  right:10px!important;
}

.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-group{
  border-color:rgba(128,161,136,.18)!important;
  background:rgba(2,10,5,.84)!important;
  box-shadow:0 7px 20px rgba(0,0,0,.28)!important;
}

/* =========================================================
   KATMANLAR — ÜSTTE PANEL DEĞİL, HARİTA ALT SHEET
   ========================================================= */
.tp-mf-layer-trigger{
  position:absolute;
  z-index:35;
  top:10px;
  right:10px;
  min-height:36px;
  display:flex;
  align-items:center;
  gap:6px;
  padding:0 9px;
  border:1px solid rgba(128,161,136,.20);
  border-radius:10px;
  background:rgba(2,10,5,.86);
  backdrop-filter:blur(9px);
  -webkit-backdrop-filter:blur(9px);
  color:rgba(232,240,234,.90);
  box-shadow:0 7px 20px rgba(0,0,0,.24);
  cursor:pointer;
}

.tp-mf-layer-trigger svg{
  width:15px;
  height:15px;
  stroke:rgba(159,190,166,.82);
  fill:none;
}

.tp-mf-layer-trigger span{
  display:grid;
  gap:1px;
  text-align:left;
}

.tp-mf-layer-trigger small{
  color:rgba(154,172,159,.52);
  font-size:6.3px;
  font-weight:800;
  letter-spacing:.06em;
  text-transform:uppercase;
}

.tp-mf-layer-trigger strong{
  color:rgba(235,242,236,.92);
  font-size:8.3px;
  font-weight:850;
}

/* Haritanın altından açılır; diğer araçlarla çakışmaz. */
.tp-mf-layer-panel{
  position:absolute;
  z-index:42;
  left:50%;
  right:auto;
  top:auto;
  bottom:12px;
  width:min(520px,calc(100% - 24px));
  transform:translateX(-50%);
  overflow:hidden;
  border:1px solid rgba(128,161,136,.20);
  border-radius:16px;
  background:
    radial-gradient(circle at 90% 0%,rgba(70,105,79,.10),transparent 34%),
    rgba(2,10,5,.96);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  box-shadow:0 18px 50px rgba(0,0,0,.48);
}

.tp-mf-layer-panel-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:10px 11px 8px;
  border-bottom:1px solid rgba(128,161,136,.09);
}

.tp-mf-layer-panel-head div{
  min-width:0;
}

.tp-mf-layer-panel-head small{
  display:block;
  color:rgba(139,178,149,.64);
  font-size:6.6px;
  font-weight:900;
  letter-spacing:.09em;
  text-transform:uppercase;
}

.tp-mf-layer-panel-head strong{
  display:block;
  margin-top:2px;
  color:rgba(237,243,238,.92);
  font-size:10.5px;
}

.tp-mf-layer-panel-close{
  width:27px;
  height:27px;
  border:0;
  border-radius:8px;
  background:rgba(255,255,255,.028);
  color:rgba(217,229,220,.70);
  font-size:16px;
  cursor:pointer;
}

.tp-mf-layer-list{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:5px;
  padding:8px;
}

.tp-mf-layer-option{
  min-width:0;
  min-height:48px;
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  justify-content:center;
  padding:7px 8px;
  border:1px solid rgba(90,120,98,.11);
  border-radius:10px;
  background:rgba(255,255,255,.014);
  color:rgba(203,216,206,.66);
  text-align:left;
  cursor:pointer;
}

.tp-mf-layer-option:hover{
  border-color:rgba(128,161,136,.24);
  background:rgba(89,124,98,.045);
}

.tp-mf-layer-option.active{
  border-color:rgba(111,164,124,.34);
  background:rgba(74,116,83,.11);
  color:rgba(238,246,240,.94);
}

.tp-mf-layer-option strong{
  overflow:hidden;
  max-width:100%;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:8.5px;
  font-weight:850;
}

.tp-mf-layer-option small{
  margin-top:2px;
  overflow:hidden;
  max-width:100%;
  text-overflow:ellipsis;
  white-space:nowrap;
  color:rgba(164,181,168,.46);
  font-size:6.2px;
  line-height:1.2;
}


/* =========================================================
   TOPRAK / İKLİM ALT KATMANLARI
   Eski subbar map-first görünümünde gizliydi. Artık seçili katmanın
   gerçek alt seçenekleri haritanın üzerinde erişilebilir.
   ========================================================= */
.tp-mf-sublayer-trigger{
  position:absolute;
  z-index:36;
  top:10px;
  left:10px;
  max-width:calc(100% - 68px);
  min-height:36px;
  display:flex;
  align-items:center;
  gap:7px;
  padding:0 10px;
  border:1px solid rgba(128,161,136,.20);
  border-radius:10px;
  background:rgba(2,10,5,.88);
  backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);
  color:rgba(232,240,234,.90);
  box-shadow:0 7px 20px rgba(0,0,0,.24);
  cursor:pointer;
}

.tp-mf-sublayer-trigger small{
  color:rgba(143,181,152,.68);
  font-size:6.5px;
  font-weight:900;
  letter-spacing:.07em;
  text-transform:uppercase;
}

.tp-mf-sublayer-trigger strong{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  color:rgba(235,242,236,.92);
  font-size:8.5px;
  font-weight:850;
}

.tp-mf-sublayer-panel{
  position:absolute;
  z-index:43;
  top:10px;
  left:10px;
  width:min(365px,calc(100% - 68px));
  overflow:hidden;
  border:1px solid rgba(128,161,136,.20);
  border-radius:14px;
  background:
    radial-gradient(circle at 0% 0%,rgba(70,105,79,.10),transparent 34%),
    rgba(2,10,5,.965);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  box-shadow:0 16px 44px rgba(0,0,0,.44);
}

.tp-mf-sublayer-head{
  min-height:35px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  padding:7px 8px 6px 10px;
  border-bottom:1px solid rgba(128,161,136,.09);
}

.tp-mf-sublayer-head div{
  min-width:0;
}

.tp-mf-sublayer-head small{
  display:block;
  color:rgba(139,178,149,.64);
  font-size:6.2px;
  font-weight:900;
  letter-spacing:.08em;
  text-transform:uppercase;
}

.tp-mf-sublayer-head strong{
  display:block;
  margin-top:2px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  color:rgba(237,243,238,.92);
  font-size:9.2px;
}

.tp-mf-sublayer-close{
  width:25px;
  height:25px;
  flex:0 0 25px;
  display:grid;
  place-items:center;
  border:0;
  border-radius:8px;
  background:rgba(255,255,255,.025);
  color:rgba(217,229,220,.72);
  font-size:15px;
  cursor:pointer;
}

.tp-mf-sublayer-group{
  padding:7px 8px 8px;
}

.tp-mf-sublayer-group + .tp-mf-sublayer-group{
  padding-top:0;
}

.tp-mf-sublayer-label{
  display:block;
  margin:0 2px 5px;
  color:rgba(158,178,163,.52);
  font-size:6.2px;
  font-weight:850;
  letter-spacing:.055em;
  text-transform:uppercase;
}

.tp-mf-sublayer-scroll{
  display:flex;
  gap:5px;
  max-width:100%;
  overflow-x:auto;
  overscroll-behavior-x:contain;
  scrollbar-width:none;
  padding-bottom:1px;
}

.tp-mf-sublayer-scroll::-webkit-scrollbar{
  display:none;
}

.tp-mf-sublayer-chip{
  flex:0 0 auto;
  min-height:28px;
  padding:0 9px;
  border:1px solid rgba(90,120,98,.12);
  border-radius:8px;
  background:rgba(255,255,255,.014);
  color:rgba(199,214,203,.66);
  font-size:7.3px;
  font-weight:800;
  white-space:nowrap;
  cursor:pointer;
}

.tp-mf-sublayer-chip.active{
  border-color:rgba(73,181,103,.36);
  background:rgba(34,197,94,.105);
  color:rgba(226,246,232,.94);
  box-shadow:inset 0 0 0 1px rgba(34,197,94,.04);
}

@media(max-width:560px){
  .tp-mf-sublayer-trigger{
    top:8px;
    left:8px;
    max-width:calc(100% - 58px);
    min-height:34px;
    padding:0 8px;
  }

  .tp-mf-sublayer-panel{
    top:8px;
    left:8px;
    width:calc(100% - 58px);
    max-height:164px;
  }

  .tp-mf-sublayer-chip{
    min-height:27px;
    padding:0 8px;
    font-size:7px;
  }
}


/* =========================================================
   NDVI — SOL ÜST KÖŞEDE KÜÇÜK KULP, SAĞA DOĞRU AÇILIR
   ========================================================= */
.tp-mf-ndvi{
  position:absolute;
  z-index:34;
  top:10px;
  left:9px;
  display:flex;
  align-items:stretch;
  max-width:calc(100% - 105px);
  transform:none;
  border:1px solid rgba(128,161,136,.18);
  border-radius:10px;
  background:rgba(2,10,5,.86);
  backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);
  box-shadow:0 7px 20px rgba(0,0,0,.26);
}

.tp-mf-ndvi-handle{
  width:48px;
  min-width:48px;
  min-height:34px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:4px;
  padding:0 5px;
  border:0;
  border-radius:9px;
  background:transparent;
  color:rgba(219,232,222,.84);
  cursor:pointer;
}

.tp-mf-ndvi-handle b{
  font-size:7.4px;
  font-weight:900;
  letter-spacing:.045em;
}

.tp-mf-ndvi-handle i{
  color:rgba(143,181,152,.62);
  font-size:11px;
  font-style:normal;
}

.tp-mf-ndvi.open .tp-mf-ndvi-handle{
  border-radius:9px 0 0 9px;
  border-right:1px solid rgba(128,161,136,.10);
}

.tp-mf-ndvi-body{
  width:150px;
  padding:8px 9px 7px;
  animation:tpMfLegendOpen .16s ease both;
}

@keyframes tpMfLegendOpen{
  from{opacity:0;transform:translateX(-4px)}
  to{opacity:1;transform:translateX(0)}
}

.tp-mf-ndvi-body>strong{
  display:block;
  margin-bottom:6px;
  color:rgba(235,243,237,.92);
  font-size:8.2px;
}

.tp-mf-ndvi-row{
  min-height:18px;
  display:grid;
  grid-template-columns:6px 43px 1fr;
  align-items:center;
  gap:4px;
}

.tp-mf-ndvi-row i{
  width:6px;
  height:6px;
  border-radius:999px;
  box-shadow:0 0 7px currentColor;
}

.tp-mf-ndvi-row span,
.tp-mf-ndvi-row b{
  color:rgba(204,216,207,.66);
  font-size:6.4px;
  font-weight:700;
}

.tp-mf-ndvi-row b{
  color:rgba(224,233,226,.76);
}

.tp-mf-ndvi-row.very i{background:#22c55e;color:#22c55e}
.tp-mf-ndvi-row.good i{background:#84cc16;color:#84cc16}
.tp-mf-ndvi-row.medium i{background:#f59e0b;color:#f59e0b}
.tp-mf-ndvi-row.weak i{background:#ef4444;color:#ef4444}

.tp-mf-ndvi-average{
  margin-top:6px;
  padding-top:6px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  border-top:1px solid rgba(128,161,136,.09);
}

.tp-mf-ndvi-average span{
  color:rgba(157,174,161,.50);
  font-size:6.2px;
}

.tp-mf-ndvi-average strong{
  color:rgba(236,243,237,.90);
  font-size:8.3px;
}

/* =========================================================
   MOBİL
   ========================================================= */
@media(max-width:560px){
  .tp-map-first-shell .tp-field-head{
    min-height:50px!important;
    padding:5px 7px!important;
  }

  .tp-map-first-shell .tp-field-toolbar{
    grid-template-columns:38px minmax(0,1fr) 38px 38px!important;
    gap:5px!important;
  }

  .tp-mf-operation-toolbar{
    width:38px!important;
    height:38px!important;
    min-width:38px!important;
    min-height:38px!important;
    border-radius:10px!important;
    font-size:17px!important;
  }

  .tp-map-first-shell .tp-field-select-box{
    min-height:38px!important;
    height:38px!important;
  }

  .tp-map-first-shell .tp-field-select{
    height:36px!important;
    min-height:36px!important;
  }

  .tp-map-first-shell .tp-field-toolbar .tp-add-field-3d{
    width:38px!important;
    height:38px!important;
    min-width:38px!important;
    min-height:38px!important;
  }

  .tp-map-first-shell .tp-map-stage{
    height:425px!important;
    min-height:425px!important;
  }

  .tp-mf-layer-trigger{
    top:8px;
    right:8px;
    min-height:33px;
    padding:0 8px;
  }

  .tp-mf-layer-trigger small{
    display:none;
  }

  .tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-top-right{
    top:48px!important;
    right:8px!important;
  }

  .tp-mf-layer-panel{
    bottom:8px;
    width:calc(100% - 16px);
    border-radius:14px;
  }

  .tp-mf-layer-list{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }

  .tp-mf-ndvi{
    top:8px;
    left:7px;
    max-width:calc(100% - 92px);
  }

  .tp-mf-ndvi-handle{
    width:44px;
    min-width:44px;
    min-height:32px;
  }

  .tp-mf-ndvi-body{
    width:138px;
  }
}

/* =========================================================
   MAP-FIRST V3 — SAĞ KONTROLLER TEK DÜZEN
   Katmanlar + zoom +/- aynı kolon; gereksiz tekrarlar gizli.
   ========================================================= */

.tp-mf-layer-trigger{
  top:10px!important;
  right:10px!important;
  width:40px!important;
  height:40px!important;
  min-width:40px!important;
  min-height:40px!important;
  padding:0!important;
  display:grid!important;
  place-items:center!important;
  border-radius:11px!important;
}

.tp-mf-layer-trigger svg{
  width:18px!important;
  height:18px!important;
}

.tp-mf-layer-trigger span{
  display:none!important;
}

/* Mevcut ray: 1=ortala, 2=+, 3=-, 4=eski katmanlar */
.tp-map-first-shell .tp-map-control-rail{
  top:55px!important;
  right:10px!important;
  z-index:33!important;
  border-radius:11px!important;
  border-color:rgba(128,161,136,.18)!important;
  background:rgba(2,10,5,.84)!important;
  box-shadow:0 7px 20px rgba(0,0,0,.27)!important;
}

.tp-map-first-shell .tp-map-control-rail .tp-map-control-btn:first-child,
.tp-map-first-shell .tp-map-control-rail .tp-map-control-btn:last-child{
  display:none!important;
}

.tp-map-first-shell .tp-map-control-rail .tp-map-control-btn{
  width:40px!important;
  height:40px!important;
  min-width:40px!important;
  min-height:40px!important;
  flex:0 0 40px!important;
  color:rgba(230,239,232,.88)!important;
}

.tp-map-first-shell .tp-map-control-rail .tp-map-control-btn svg{
  width:19px!important;
  height:19px!important;
}

/* Alt sağ pusula daha sessiz */
.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right{
  right:10px!important;
  bottom:10px!important;
  top:auto!important;
}

.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group.tp-map-compass,
.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right .tp-map-compass__button{
  width:38px!important;
  height:38px!important;
  min-width:38px!important;
  min-height:38px!important;
  border-radius:10px!important;
  opacity:.88!important;
}

.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right .tp-map-compass__rose{
  width:31px!important;
  height:31px!important;
  margin-left:-15.5px!important;
  margin-top:-15.5px!important;
}

/* MapLibre'ın eski sağ üst kontrolleri tekrar görünmesin */
.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-top-right{
  display:none!important;
}

@media(max-width:560px){
  .tp-mf-layer-trigger{
    top:8px!important;
    right:8px!important;
    width:36px!important;
    height:36px!important;
    min-width:36px!important;
    min-height:36px!important;
  }

  .tp-map-first-shell .tp-map-control-rail{
    top:49px!important;
    right:8px!important;
  }

  .tp-map-first-shell .tp-map-control-rail .tp-map-control-btn{
    width:36px!important;
    height:36px!important;
    min-width:36px!important;
    min-height:36px!important;
    flex-basis:36px!important;
  }

  .tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right{
    right:8px!important;
    bottom:8px!important;
  }

  .tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group.tp-map-compass,
  .tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right .tp-map-compass__button{
    width:34px!important;
    height:34px!important;
    min-width:34px!important;
    min-height:34px!important;
    border-radius:9px!important;
  }

  .tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right .tp-map-compass__rose{
    width:28px!important;
    height:28px!important;
    margin-left:-14px!important;
    margin-top:-14px!important;
  }
}

`

function LayerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3-8.5 4.5L12 12l8.5-4.5L12 3Z" strokeWidth="1.7" />
      <path d="m4 12 8 4.2 8-4.2M4 16.3l8 4.2 8-4.2" strokeWidth="1.7" />
    </svg>
  );
}

export default function HomeMapSectionMapFirst(
  props: HomeMapSectionMapFirstProps,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [mapStage, setMapStage] = useState<HTMLElement | null>(null);
  const [fieldToolbar, setFieldToolbar] = useState<HTMLElement | null>(null);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [subLayerMenuOpen, setSubLayerMenuOpen] = useState(false);

  // Haritayı mümkün olduğunca açık tutmak için lejant varsayılan kapalı.
  const [ndviLegendOpen, setNdviLegendOpen] = useState(false);

  const activeLayer = props.activeHomeLayer as HomeLayer;
  const satelliteData = props.satelliteData ?? null;

  const homeSoilProperty =
    (props.homeSoilProperty ?? 'phh2o') as HomeSoilProperty;
  const homeSoilDepth =
    (props.homeSoilDepth ?? '0-5cm') as HomeSoilDepth;
  const homeClimateLayer =
    (props.homeClimateLayer ?? 'soil-moisture') as HomeClimateLayer;
  const homeClimateDepth =
    (props.homeClimateDepth ?? '0-7cm') as HomeClimateDepth;

  const activeLayerOption = useMemo(
    () => LAYERS.find((item) => item.id === activeLayer) ?? LAYERS[0],
    [activeLayer],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const syncTargets = () => {
      const nextStage = root.querySelector('.tp-map-stage') as HTMLElement | null;
      const nextToolbar = root.querySelector('.tp-field-toolbar') as HTMLElement | null;
      setMapStage((current) => (current === nextStage ? current : nextStage));
      setFieldToolbar((current) => (current === nextToolbar ? current : nextToolbar));
    };

    syncTargets();

    const observer = new MutationObserver(syncTargets);
    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setLayerMenuOpen(false);
    setNdviLegendOpen(false);
    setSubLayerMenuOpen(
      activeLayer === 'soil' || activeLayer === 'climate',
    );
  }, [activeLayer]);

  const selectLayer = (layer: HomeLayer) => {
    setLayerMenuOpen(false);

    if (typeof props.openMapLayer === 'function') {
      props.openMapLayer(layer);
    }

    // Map-first görünümde eski ayrı Toprak/İklim popover'ını açtırmıyoruz.
    // Alt seçimler aşağıdaki kendi panelimizden yapılır.
    if (typeof props.setSoilMenuOpen === 'function') {
      props.setSoilMenuOpen(false);
    }
    if (typeof props.setClimateMenuOpen === 'function') {
      props.setClimateMenuOpen(false);
    }
  };

  const subLayerSummary =
    activeLayer === 'soil'
      ? `${HOME_SOIL_PROPERTY_LABELS[homeSoilProperty]} · ${HOME_SOIL_DEPTH_LABELS[homeSoilDepth]}`
      : activeLayer === 'climate'
        ? `${HOME_CLIMATE_LAYER_LABELS[homeClimateLayer]}${
            homeClimateLayer === 'soil-moisture' ||
            homeClimateLayer === 'soil-temperature'
              ? ` · ${HOME_CLIMATE_DEPTH_LABELS[homeClimateDepth]}`
              : ''
          }`
        : '';

  const setSoilProperty = (value: HomeSoilProperty) => {
    if (typeof props.setHomeSoilProperty === 'function') {
      props.setHomeSoilProperty(value);
    }
  };

  const setSoilDepth = (value: HomeSoilDepth) => {
    if (typeof props.setHomeSoilDepth === 'function') {
      props.setHomeSoilDepth(value);
    }
  };

  const setClimateLayer = (value: HomeClimateLayer) => {
    if (typeof props.setHomeClimateLayer === 'function') {
      props.setHomeClimateLayer(value);
    }
  };

  const setClimateDepth = (value: HomeClimateDepth) => {
    if (typeof props.setHomeClimateDepth === 'function') {
      props.setHomeClimateDepth(value);
    }
  };

  const ndviAverage =
    satelliteData?.ndviAverage != null &&
    Number.isFinite(Number(satelliteData.ndviAverage))
      ? Number(satelliteData.ndviAverage).toFixed(2)
      : '—';

  const operationToolbarButton =
    fieldToolbar != null
      ? createPortal(
          <button
            type="button"
            className="tp-mf-operation-toolbar"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('tp:home-map-open-field-operation'),
                );
              }
            }}
            aria-label="Tarla işlemi ekle"
            title="Tarlada yaptığın işlemi kaydet"
          >
            <span aria-hidden="true">🚜</span>
          </button>,
          fieldToolbar,
        )
      : null;

  const mapOverlay =
    mapStage != null
      ? createPortal(
          <>
            <button
              type="button"
              className="tp-mf-layer-trigger"
              onClick={() => {
                setNdviLegendOpen(false);
                setLayerMenuOpen((open) => !open);
              }}
              aria-expanded={layerMenuOpen}
              aria-label="Harita katmanlarını aç"
            >
              <LayerIcon />
              <span>
                <small>Katmanlar</small>
                <strong>{activeLayerOption.shortLabel}</strong>
              </span>
            </button>

            {layerMenuOpen ? (
              <section
                className="tp-mf-layer-panel"
                role="dialog"
                aria-label="Harita katmanları"
              >
                <div className="tp-mf-layer-panel-head">
                  <div>
                    <small>HARİTA</small>
                    <strong>Katman seç</strong>
                  </div>
                  <button
                    type="button"
                    className="tp-mf-layer-panel-close"
                    onClick={() => setLayerMenuOpen(false)}
                    aria-label="Katmanları kapat"
                  >
                    ×
                  </button>
                </div>

                <div className="tp-mf-layer-list">
                  {LAYERS.map((layer) => (
                    <button
                      type="button"
                      key={layer.id}
                      className={`tp-mf-layer-option ${
                        layer.id === activeLayer ? 'active' : ''
                      }`}
                      onClick={() => selectLayer(layer.id)}
                    >
                      <strong>{layer.label}</strong>
                      <small>{layer.hint}</small>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {(activeLayer === 'soil' || activeLayer === 'climate') ? (
              subLayerMenuOpen ? (
                <section
                  className="tp-mf-sublayer-panel"
                  role="dialog"
                  aria-label={
                    activeLayer === 'soil'
                      ? 'Toprak alt katmanları'
                      : 'İklim alt katmanları'
                  }
                >
                  <div className="tp-mf-sublayer-head">
                    <div>
                      <small>
                        {activeLayer === 'soil' ? 'TOPRAK' : 'İKLİM'}
                      </small>
                      <strong>{subLayerSummary}</strong>
                    </div>

                    <button
                      type="button"
                      className="tp-mf-sublayer-close"
                      onClick={() => setSubLayerMenuOpen(false)}
                      aria-label="Alt katmanları kapat"
                    >
                      ×
                    </button>
                  </div>

                  {activeLayer === 'soil' ? (
                    <>
                      <div className="tp-mf-sublayer-group">
                        <span className="tp-mf-sublayer-label">
                          Toprak özelliği
                        </span>
                        <div className="tp-mf-sublayer-scroll">
                          {(
                            Object.keys(
                              HOME_SOIL_PROPERTY_LABELS,
                            ) as HomeSoilProperty[]
                          ).map((property) => (
                            <button
                              type="button"
                              key={property}
                              className={`tp-mf-sublayer-chip ${
                                homeSoilProperty === property ? 'active' : ''
                              }`}
                              onClick={() => setSoilProperty(property)}
                            >
                              {HOME_SOIL_PROPERTY_LABELS[property]}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="tp-mf-sublayer-group">
                        <span className="tp-mf-sublayer-label">
                          Derinlik
                        </span>
                        <div className="tp-mf-sublayer-scroll">
                          {(
                            Object.keys(
                              HOME_SOIL_DEPTH_LABELS,
                            ) as HomeSoilDepth[]
                          ).map((depth) => (
                            <button
                              type="button"
                              key={depth}
                              className={`tp-mf-sublayer-chip ${
                                homeSoilDepth === depth ? 'active' : ''
                              }`}
                              onClick={() => setSoilDepth(depth)}
                            >
                              {HOME_SOIL_DEPTH_LABELS[depth]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="tp-mf-sublayer-group">
                        <span className="tp-mf-sublayer-label">
                          İklim verisi
                        </span>
                        <div className="tp-mf-sublayer-scroll">
                          {(
                            Object.keys(
                              HOME_CLIMATE_LAYER_LABELS,
                            ) as HomeClimateLayer[]
                          ).map((item) => (
                            <button
                              type="button"
                              key={item}
                              className={`tp-mf-sublayer-chip ${
                                homeClimateLayer === item ? 'active' : ''
                              }`}
                              onClick={() => setClimateLayer(item)}
                            >
                              {HOME_CLIMATE_LAYER_LABELS[item]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(homeClimateLayer === 'soil-moisture' ||
                        homeClimateLayer === 'soil-temperature') ? (
                        <div className="tp-mf-sublayer-group">
                          <span className="tp-mf-sublayer-label">
                            Derinlik
                          </span>
                          <div className="tp-mf-sublayer-scroll">
                            {(
                              Object.keys(
                                HOME_CLIMATE_DEPTH_LABELS,
                              ) as HomeClimateDepth[]
                            )
                              .filter((depth) =>
                                homeClimateLayer === 'soil-temperature'
                                  ? depth !== '28-100cm'
                                  : true,
                              )
                              .map((depth) => (
                                <button
                                  type="button"
                                  key={depth}
                                  className={`tp-mf-sublayer-chip ${
                                    homeClimateDepth === depth ? 'active' : ''
                                  }`}
                                  onClick={() => setClimateDepth(depth)}
                                >
                                  {HOME_CLIMATE_DEPTH_LABELS[depth]}
                                </button>
                              ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </section>
              ) : (
                <button
                  type="button"
                  className="tp-mf-sublayer-trigger"
                  onClick={() => {
                    setLayerMenuOpen(false);
                    setNdviLegendOpen(false);
                    setSubLayerMenuOpen(true);
                  }}
                  aria-expanded={false}
                  aria-label={
                    activeLayer === 'soil'
                      ? 'Toprak alt katmanlarını aç'
                      : 'İklim alt katmanlarını aç'
                  }
                >
                  <small>
                    {activeLayer === 'soil' ? 'Toprak' : 'İklim'}
                  </small>
                  <strong>{subLayerSummary}</strong>
                </button>
              )
            ) : null}

            {activeLayer === 'vegetation' ? (
              <aside
                className={`tp-mf-ndvi ${ndviLegendOpen ? 'open' : ''}`}
                aria-label="NDVI açıklaması"
              >
                <button
                  type="button"
                  className="tp-mf-ndvi-handle"
                  onClick={() => {
                    setLayerMenuOpen(false);
                    setNdviLegendOpen((open) => !open);
                  }}
                  aria-expanded={ndviLegendOpen}
                  title={ndviLegendOpen ? 'NDVI açıklamasını kapat' : 'NDVI açıklamasını aç'}
                >
                  <b>NDVI</b>
                  <i aria-hidden="true">{ndviLegendOpen ? '‹' : '›'}</i>
                </button>

                {ndviLegendOpen ? (
                  <div className="tp-mf-ndvi-body">
                    <strong>Bitki Sağlığı</strong>

                    <div className="tp-mf-ndvi-row very">
                      <i />
                      <span>0.8 – 1.0</span>
                      <b>Çok Sağlıklı</b>
                    </div>
                    <div className="tp-mf-ndvi-row good">
                      <i />
                      <span>0.6 – 0.8</span>
                      <b>Sağlıklı</b>
                    </div>
                    <div className="tp-mf-ndvi-row medium">
                      <i />
                      <span>0.3 – 0.6</span>
                      <b>Orta</b>
                    </div>
                    <div className="tp-mf-ndvi-row weak">
                      <i />
                      <span>0.1 – 0.3</span>
                      <b>Zayıf</b>
                    </div>

                    <div className="tp-mf-ndvi-average">
                      <span>Tarla Ortalaması</span>
                      <strong>{ndviAverage}</strong>
                    </div>
                  </div>
                ) : null}
              </aside>
            ) : null}
          </>,
          mapStage,
        )
      : null;

  return (
    <div ref={rootRef} className="tp-map-first-shell">
      <style>{CSS}</style>

      <HomeMapSection {...props} />

      {operationToolbarButton}
      {mapOverlay}
    </div>
  );
}

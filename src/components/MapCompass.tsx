import type {
  ControlPosition,
  IControl,
  Map as MapLibreMap,
} from 'maplibre-gl';

class TarlaCompassControl implements IControl {
  private map?: MapLibreMap;
  private container?: HTMLDivElement;
  private rose?: HTMLDivElement;
  private heading?: HTMLSpanElement;

  private readonly updateBearing = () => {
    if (!this.map) return;

    const bearing = this.map.getBearing();
    const normalized = Math.round((bearing + 360) % 360);

    if (this.rose) {
      this.rose.style.transform = `rotate(${-bearing}deg)`;
    }

    if (this.heading) {
      this.heading.textContent = `${normalized}°`;
    }
  };

  onAdd(map: MapLibreMap) {
    this.map = map;

    const container = document.createElement('div');
    container.className =
      'maplibregl-ctrl maplibregl-ctrl-group mapboxgl-ctrl mapboxgl-ctrl-group tp-map-compass';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tp-map-compass__button';
    button.setAttribute('aria-label', 'Gerçek pusula · haritayı kuzeye döndür');
    button.title = 'Kuzeye döndür';

    const rose = document.createElement('div');
    rose.className = 'tp-map-compass__rose';
    rose.innerHTML = `
      <span class="tp-map-compass__ring" aria-hidden="true"></span>
      <span class="tp-map-compass__ticks" aria-hidden="true"></span>

      <span class="tp-map-compass__label tp-map-compass__north">K</span>
      <span class="tp-map-compass__label tp-map-compass__east">D</span>
      <span class="tp-map-compass__label tp-map-compass__south">G</span>
      <span class="tp-map-compass__label tp-map-compass__west">B</span>

      <span class="tp-map-compass__needle" aria-hidden="true">
        <span class="tp-map-compass__needle-north"></span>
        <span class="tp-map-compass__needle-south"></span>
      </span>

      <span class="tp-map-compass__center" aria-hidden="true"></span>
    `;

    const heading = document.createElement('span');
    heading.className = 'tp-map-compass__heading';
    heading.setAttribute('aria-hidden', 'true');
    heading.textContent = '0°';

    button.appendChild(rose);
    button.appendChild(heading);
    container.appendChild(button);

    if (!document.getElementById('tp-map-compass-style')) {
      const style = document.createElement('style');
      style.id = 'tp-map-compass-style';

      style.textContent = `
        .maplibregl-ctrl-group.tp-map-compass{
          display:block!important;
          width:48px!important;
          height:48px!important;
          margin:10px!important;
          border:1px solid rgba(99,138,109,.28)!important;
          border-radius:50%!important;
          overflow:visible!important;
          background:
            radial-gradient(circle at 48% 38%,rgba(34,197,94,.10),transparent 48%),
            linear-gradient(180deg,rgba(3,13,7,.96),rgba(1,7,4,.98))!important;
          box-shadow:
            0 8px 22px rgba(0,0,0,.34),
            inset 0 1px 0 rgba(255,255,255,.04),
            0 0 0 1px rgba(34,197,94,.035)!important;
          backdrop-filter:blur(12px);
          -webkit-backdrop-filter:blur(12px);
        }

        .maplibregl-ctrl-group.tp-map-compass button.tp-map-compass__button{
          display:block!important;
          position:relative!important;
          width:48px!important;
          height:48px!important;
          padding:0!important;
          border:0!important;
          border-radius:50%!important;
          background:transparent!important;
          cursor:pointer!important;
          color:#edf4ed!important;
          overflow:visible!important;
        }

        .tp-map-compass__button:focus-visible{
          outline:2px solid rgba(74,222,128,.72)!important;
          outline-offset:2px;
        }

        .tp-map-compass__rose{
          position:absolute;
          inset:0;
          transition:transform .18s ease-out;
          will-change:transform;
        }

        .tp-map-compass__ring{
          position:absolute;
          inset:7px;
          border:1px solid rgba(200,221,205,.15);
          border-radius:50%;
          box-shadow:inset 0 0 0 1px rgba(0,0,0,.26);
        }

        .tp-map-compass__ticks{
          position:absolute;
          inset:6px;
          border-radius:50%;
          background:
            linear-gradient(to bottom,rgba(235,244,237,.48),rgba(235,244,237,.48)) center top/1px 4px no-repeat,
            linear-gradient(to bottom,rgba(235,244,237,.24),rgba(235,244,237,.24)) center bottom/1px 4px no-repeat,
            linear-gradient(to right,rgba(235,244,237,.24),rgba(235,244,237,.24)) left center/4px 1px no-repeat,
            linear-gradient(to right,rgba(235,244,237,.24),rgba(235,244,237,.24)) right center/4px 1px no-repeat;
          opacity:.84;
        }

        .tp-map-compass__label{
          position:absolute;
          z-index:3;
          font:800 6px/1 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          letter-spacing:.02em;
          color:rgba(210,225,214,.48);
          text-shadow:0 1px 2px rgba(0,0,0,.8);
          user-select:none;
        }

        .tp-map-compass__north{
          top:3px;
          left:50%;
          transform:translateX(-50%);
          color:#86efac;
          font-size:8px;
        }

        .tp-map-compass__east{
          right:3px;
          top:50%;
          transform:translateY(-50%);
        }

        .tp-map-compass__south{
          bottom:3px;
          left:50%;
          transform:translateX(-50%);
        }

        .tp-map-compass__west{
          left:3px;
          top:50%;
          transform:translateY(-50%);
        }

        .tp-map-compass__needle{
          position:absolute;
          z-index:4;
          left:50%;
          top:50%;
          width:11px;
          height:27px;
          transform:translate(-50%,-50%);
          filter:drop-shadow(0 2px 3px rgba(0,0,0,.62));
        }

        .tp-map-compass__needle-north{
          position:absolute;
          left:50%;
          top:0;
          width:0;
          height:0;
          transform:translateX(-50%);
          border-left:3.5px solid transparent;
          border-right:3.5px solid transparent;
          border-bottom:12px solid #22c55e;
        }

        .tp-map-compass__needle-south{
          position:absolute;
          left:50%;
          bottom:0;
          width:0;
          height:0;
          transform:translateX(-50%);
          border-left:3px solid transparent;
          border-right:3px solid transparent;
          border-top:11px solid rgba(225,235,227,.72);
        }

        .tp-map-compass__center{
          position:absolute;
          z-index:5;
          left:50%;
          top:50%;
          width:5px;
          height:5px;
          transform:translate(-50%,-50%);
          border:1px solid rgba(2,7,4,.96);
          border-radius:50%;
          background:#dff7e5;
          box-shadow:0 0 0 2px rgba(34,197,94,.13),0 1px 4px rgba(0,0,0,.7);
        }

        .tp-map-compass__heading{
          position:absolute;
          left:50%;
          bottom:-15px;
          transform:translateX(-50%);
          min-width:28px;
          padding:2px 5px;
          border:1px solid rgba(99,138,109,.20);
          border-radius:999px;
          background:rgba(2,10,5,.86);
          color:rgba(210,225,214,.72);
          font:800 6px/1 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          text-align:center;
          letter-spacing:.03em;
          box-shadow:0 3px 10px rgba(0,0,0,.2);
          pointer-events:none;
        }

        @media (max-width:640px){
          .maplibregl-ctrl-group.tp-map-compass{
            width:44px!important;
            height:44px!important;
            margin:9px!important;
          }

          .maplibregl-ctrl-group.tp-map-compass button.tp-map-compass__button{
            width:44px!important;
            height:44px!important;
          }

          .tp-map-compass__ring{inset:6px;}
          .tp-map-compass__ticks{inset:5px;}
          .tp-map-compass__needle{height:25px;}
        }
      `;

      document.head.appendChild(style);
    }

    button.addEventListener('click', () => {
      this.map?.easeTo({
        bearing: 0,
        duration: 420,
      });
    });

    this.container = container;
    this.rose = rose;
    this.heading = heading;

    map.on('rotate', this.updateBearing);
    this.updateBearing();

    return container;
  }

  onRemove() {
    this.map?.off('rotate', this.updateBearing);
    this.container?.remove();

    this.map = undefined;
    this.container = undefined;
    this.rose = undefined;
    this.heading = undefined;
  }
}

export function addTarlaCompass(
  map: MapLibreMap,
  position: ControlPosition = 'bottom-left',
) {
  const control = new TarlaCompassControl();
  map.addControl(control, position);
  return control;
}

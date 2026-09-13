import type {
  ControlPosition,
  IControl,
  Map as MapLibreMap,
} from 'maplibre-gl';

class TarlaCompassControl implements IControl {
  private map?: MapLibreMap;
  private container?: HTMLDivElement;
  private rose?: HTMLDivElement;

  private readonly updateBearing = () => {
    if (this.map && this.rose) {
      this.rose.style.transform = `rotate(${-this.map.getBearing()}deg)`;
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
    button.setAttribute('aria-label', 'Haritayı kuzeye döndür');
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

    button.appendChild(rose);
    container.appendChild(button);

    if (!document.getElementById('tp-map-compass-style')) {
      const style = document.createElement('style');
      style.id = 'tp-map-compass-style';

      style.textContent = `
        .maplibregl-ctrl-group.tp-map-compass{
          display:block!important;
          width:58px!important;
          height:58px!important;
          margin:12px!important;
          border:1px solid rgba(184,205,187,.18)!important;
          border-radius:18px!important;
          overflow:hidden!important;
          background:
            radial-gradient(circle at 50% 42%,rgba(87,129,96,.10),transparent 48%),
            linear-gradient(180deg,rgba(7,15,10,.90),rgba(3,9,6,.94))!important;
          box-shadow:
            0 10px 24px rgba(0,0,0,.28),
            inset 0 1px 0 rgba(255,255,255,.035)!important;
          backdrop-filter:blur(12px);
          -webkit-backdrop-filter:blur(12px);
        }

        .maplibregl-ctrl-group.tp-map-compass
        button.tp-map-compass__button{
          display:block!important;
          position:relative!important;
          width:58px!important;
          height:58px!important;
          padding:0!important;
          border:0!important;
          border-radius:18px!important;
          background:transparent!important;
          cursor:pointer!important;
          color:#edf4ed!important;
        }

        .tp-map-compass__button:hover{
          background:rgba(112,227,154,.035)!important;
        }

        .tp-map-compass__button:focus-visible{
          outline:1px solid rgba(161,215,175,.72)!important;
          outline-offset:-3px;
        }

        .tp-map-compass__rose{
          position:absolute;
          inset:0;
          transition:transform .18s ease-out;
          will-change:transform;
        }

        .tp-map-compass__ring{
          position:absolute;
          inset:10px;
          border:1px solid rgba(206,224,209,.15);
          border-radius:50%;
          box-shadow:
            inset 0 0 0 1px rgba(0,0,0,.25),
            0 0 12px rgba(111,196,135,.025);
        }

        .tp-map-compass__ticks{
          position:absolute;
          inset:8px;
          border-radius:50%;
          background:
            linear-gradient(to bottom,rgba(231,238,232,.35),rgba(231,238,232,.35)) center top/1px 4px no-repeat,
            linear-gradient(to bottom,rgba(231,238,232,.24),rgba(231,238,232,.24)) center bottom/1px 4px no-repeat,
            linear-gradient(to right,rgba(231,238,232,.24),rgba(231,238,232,.24)) left center/4px 1px no-repeat,
            linear-gradient(to right,rgba(231,238,232,.24),rgba(231,238,232,.24)) right center/4px 1px no-repeat;
          opacity:.72;
        }

        .tp-map-compass__label{
          position:absolute;
          z-index:3;
          font:800 7px/1 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          letter-spacing:.02em;
          color:rgba(215,226,217,.46);
          text-shadow:0 1px 2px rgba(0,0,0,.75);
          user-select:none;
        }

        .tp-map-compass__north{
          top:5px;
          left:50%;
          transform:translateX(-50%);
          color:#d9c27d;
          font-size:9px;
        }

        .tp-map-compass__east{
          right:5px;
          top:50%;
          transform:translateY(-50%);
        }

        .tp-map-compass__south{
          bottom:5px;
          left:50%;
          transform:translateX(-50%);
        }

        .tp-map-compass__west{
          left:5px;
          top:50%;
          transform:translateY(-50%);
        }

        .tp-map-compass__needle{
          position:absolute;
          z-index:4;
          left:50%;
          top:50%;
          width:14px;
          height:31px;
          transform:translate(-50%,-50%);
          filter:drop-shadow(0 2px 3px rgba(0,0,0,.55));
        }

        .tp-map-compass__needle-north{
          position:absolute;
          left:50%;
          top:0;
          width:0;
          height:0;
          transform:translateX(-50%);
          border-left:4px solid transparent;
          border-right:4px solid transparent;
          border-bottom:14px solid #d8bd68;
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
          border-top:12px solid rgba(224,232,225,.72);
        }

        .tp-map-compass__center{
          position:absolute;
          z-index:5;
          left:50%;
          top:50%;
          width:6px;
          height:6px;
          transform:translate(-50%,-50%);
          border:1px solid rgba(2,7,4,.92);
          border-radius:50%;
          background:#d8bd68;
          box-shadow:
            0 0 0 2px rgba(216,189,104,.12),
            0 1px 4px rgba(0,0,0,.65);
        }

        @media (max-width:640px){
          .maplibregl-ctrl-group.tp-map-compass{
            width:54px!important;
            height:54px!important;
            margin:10px!important;
            border-radius:16px!important;
          }

          .maplibregl-ctrl-group.tp-map-compass
          button.tp-map-compass__button{
            width:54px!important;
            height:54px!important;
            border-radius:16px!important;
          }

          .tp-map-compass__ring{
            inset:9px;
          }

          .tp-map-compass__needle{
            height:29px;
          }
        }
      `;

      document.head.appendChild(style);
    }

    button.addEventListener('click', () => {
      this.map?.easeTo({
        bearing: 0,
        duration: 450,
      });
    });

    this.container = container;
    this.rose = rose;

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
  }
}

export function addTarlaCompass(
  map: MapLibreMap,
  position: ControlPosition = 'top-right',
) {
  const control = new TarlaCompassControl();
  map.addControl(control, position);
  return control;
}

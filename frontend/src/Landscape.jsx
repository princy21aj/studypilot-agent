import { useRef } from 'react';

export default function Landscape() {
  const scene = useRef(null);

  const moveScene = (event) => {
    if (!scene.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = scene.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    scene.current.style.setProperty('--pointer-x', x.toFixed(3));
    scene.current.style.setProperty('--pointer-y', y.toFixed(3));
  };

  return (
    <svg
      ref={scene}
      className="landscape"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="A glowing storybook floating over a mountain valley beneath a distant castle"
      onPointerMove={moveScene}
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor="#a4c9c0" />
          <stop offset=".46" stopColor="#e4ece1" />
          <stop offset="1" stopColor="#f4ead2" />
        </linearGradient>
        <linearGradient id="far-mountain" x2="0" y2="1">
          <stop stopColor="#d1dfd2" />
          <stop offset="1" stopColor="#78948b" />
        </linearGradient>
        <linearGradient id="mid-mountain" x2="0" y2="1">
          <stop stopColor="#718f83" />
          <stop offset="1" stopColor="#355b54" />
        </linearGradient>
        <linearGradient id="near-mountain" x2="0" y2="1">
          <stop stopColor="#41645b" />
          <stop offset="1" stopColor="#1c3b39" />
        </linearGradient>
        <linearGradient id="water" x2="0" y2="1">
          <stop stopColor="#a6d7cc" stopOpacity=".95" />
          <stop offset="1" stopColor="#3d7771" stopOpacity=".9" />
        </linearGradient>
        <linearGradient id="book-cover" x2="1" y2="1">
          <stop stopColor="#92648d" />
          <stop offset=".52" stopColor="#63466e" />
          <stop offset="1" stopColor="#392f54" />
        </linearGradient>
        <linearGradient id="book-pages" x2="0" y2="1">
          <stop stopColor="#fff8d8" />
          <stop offset="1" stopColor="#e9b875" />
        </linearGradient>
        <radialGradient id="sun-glow">
          <stop stopColor="#fffbe4" stopOpacity=".95" />
          <stop offset=".24" stopColor="#ffe8b7" stopOpacity=".48" />
          <stop offset="1" stopColor="#ffe4c2" stopOpacity="0" />
        </radialGradient>
        <filter id="soft-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <g id="pixel-pine" shapeRendering="crispEdges">
          <path d="M46 0h8v13h10v13h10v13h10v13h9v16H78v14h9v16H74v13h12v16H68v45H32v-45H14v-16h12v-13H10V95h9V81H6V68h9V52h10V39h10V26h11Z"
            fill="#315b4e" />
          <rect x="42" y="162" width="16" height="42" fill="#86684b" />
        </g>
      </defs>
      <rect width="1600" height="1000" fill="url(#sky)" />
      <circle cx="800" cy="483" r="330" fill="url(#sun-glow)" />
      <g className="parallax-clouds">
        <g fill="#fff5f5" opacity=".58">
          <ellipse cx="176" cy="300" rx="150" ry="35" />
          <ellipse cx="250" cy="284" rx="94" ry="49" />
          <ellipse cx="1340" cy="298" rx="192" ry="38" />
          <ellipse cx="1434" cy="274" rx="116" ry="52" />
          <ellipse cx="670" cy="250" rx="108" ry="24" />
        </g>
        <path d="M0 400 180 230l127 148 125-207 201 239 168-177 176 163 134-209 193 225 159-150 137 151v210H0Z"
          fill="url(#far-mountain)" opacity=".8" />
        <path d="m190 294 117 84-58-15-69 27 125-161 78 132-69-27-49 14Zm448-1 163 177-113-43-90 26 145-153 125 142-98-30-93 30Zm558-8 140 142-91-30-79 27 126-180 112 160-85-23-74 26Z"
          fill="#eff3e8" opacity=".84" />
      </g>
      <g className="parallax-back">
        <path d="m0 548 172-173 86 83 145-190 192 245 151-192 174 200 170-205 151 211 137-138 222 173v438H0Z"
          fill="url(#mid-mountain)" />
        <path d="m151 413 107 45-58-5-45 19 148-204 92 155-73-28-63 25Zm451 35 145 65-68-15-64 25 144-197 103 146-81-22-75 34Zm471-14 145 70-89-17-47 20 146-205 119 167-83-19-71 30Z"
          fill="#e3eee3" opacity=".82" />
        <path d="m1035 421 62 65-54-16-26 8 69-87 44 74-43-13-36 17Z" fill="#fff" opacity=".7" />
      </g>
      <g className="castle" fill="#31544f">
        <path d="M1162 368h19v-47h16v47h23v-62h16v62h17v-79h19v79h18v-51h16v51h24v99h-188Z" />
        <path d="M1145 389h224v20h-224z" fill="#466f65" />
        <path d="M1196 418h27v49h-27zm67-1h27v49h-27z" fill="#dfcba6" opacity=".8" />
        <path d="m1176 321 13-27 13 27zm43-15 12-24 13 24zm36 1 13-27 13 27zm41 8 12-24 13 24z" fill="#e8eedf" />
      </g>
      <path d="M0 625q170-122 352-72t328 4q155-49 330 7t310-8q145-53 280 24v420H0Z" fill="#55786c" opacity=".78" />
      <path d="M0 740q192-104 367-33t351-18q193-89 372-11t510-48v370H0Z" fill="url(#water)" />
      <path d="M1256 478q-13 68-7 117t-16 90q32-23 31-73t25-130Z" fill="#d9eee3" opacity=".85" />
      <path d="M1285 483q-7 56-3 93t-9 61q22-21 20-60t14-98Z" fill="#f3f5e8" opacity=".7" />
      <path d="M810 648q42 53 73 89t47 109q14-60-6-111t-61-99Z" fill="#dff1e7" opacity=".86" />
      <path d="M0 733q180-91 343-37t331-21q193-90 370-7t556-47v82q-223 54-430 0t-376 27q-187 69-360 5T0 811Z"
        fill="#355b54" opacity=".83" />
      <path d="M0 828q172-111 376-48t378-27q190-93 399-21t447-40v308H0Z" fill="url(#near-mountain)" />
      <g className="parallax-front" fill="#1c3b39">
        <path d="m0 752 96-36 91 45 93-28 108 49 83-16 83 56 93-23 93 47 93-25 91 47 102-33 115 56 103-21 146 48v102H0Z" />
        <path d="m0 760 22-84 18 84zm71 6 36-121 28 126zm130 14 29-78 27 90zm117 18 44-123 33 132zm164 22 32-87 27 93zm704 4 33-101 32 111zm124 19 37-139 39 148zm139 16 24-89 30 92zm98 10 39-133 41 142z" />
        <g fill="#df9acb">
          <path d="m179 778 12-24 12 24zm-88 21 9-17 10 17zm1313 48 10-19 10 19zm-1360 28 7-14 9 14z" />
        </g>
      </g>
      <g className="parallax-pines" shapeRendering="crispEdges">
        <use href="#pixel-pine" transform="translate(38 613) scale(.92)" />
        <use href="#pixel-pine" transform="translate(155 661) scale(.62)" />
        <use href="#pixel-pine" transform="translate(1350 618) scale(.88)" />
        <use href="#pixel-pine" transform="translate(1280 664) scale(.65)" />
        <use href="#pixel-pine" transform="translate(1440 674) scale(.55)" />
      </g>
      <g className="book-aura">
        <ellipse cx="800" cy="699" rx="198" ry="54" fill="#ffdb9c" opacity=".32" filter="url(#soft-glow)" />
        <ellipse cx="800" cy="710" rx="219" ry="48" fill="none" stroke="#ffe8b3" strokeWidth="4" opacity=".85" />
        <ellipse cx="800" cy="710" rx="246" ry="58" fill="none" stroke="#fff4d2" strokeWidth="2" opacity=".55" />
      </g>
      <g className="book-float">
        <path d="m800 612-116-48q-10-4-10 8v89q0 10 10 14l116 45 116-45q10-4 10-14v-89q0-12-10-8Z"
          fill="url(#book-cover)" stroke="#ffdfaa" strokeWidth="4" />
        <path d="m800 614-107-44v80l107 44zm0 0 107-44v80l-107 44z" fill="url(#book-pages)" stroke="#fff2cf" strokeWidth="2" />
        <path d="M800 614v80" stroke="#9a603d" strokeWidth="4" />
        <path d="m747 594 53-18 53 18-53 21Z" fill="#ffe5a7" />
        <path d="m800 581 8 13 16 2-12 10 3 15-15-8-14 8 3-15-12-10 16-2Z" fill="#7451a1" />
        <path d="m708 671 70 29m114-29-70 29" stroke="#c58f63" strokeWidth="2" opacity=".8" />
      </g>
      <g fill="#fff1c8">
        <circle cx="643" cy="666" r="4" /><circle cx="962" cy="650" r="3" /><circle cx="706" cy="548" r="3" />
        <circle cx="913" cy="565" r="4" /><circle cx="1018" cy="725" r="3" /><circle cx="598" cy="731" r="3" />
        <circle cx="840" cy="535" r="2" /><circle cx="756" cy="748" r="3" />
      </g>
    </svg>
  );
}

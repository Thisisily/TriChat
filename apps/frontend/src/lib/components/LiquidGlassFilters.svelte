<div class="liquid-glass-filters">
  <svg
    width="0"
    height="0"
    style="position: absolute;"
  >
    <defs>
      <!-- Subtle Glass Blur -->
      <filter id="glassBlur">
        <feGaussianBlur in="SourceGraphic" stdDeviation="20" />
        <feColorMatrix type="saturate" values="1.8" />
        <feComponentTransfer>
          <feFuncA type="discrete" tableValues="1 1" />
        </feComponentTransfer>
      </filter>

      <!-- Enhanced Glass Effect -->
      <filter id="enhancedGlass">
        <feGaussianBlur in="SourceAlpha" result="blur" stdDeviation="5"/>
        <feSpecularLighting result="specOut" in="blur" specularConstant="2.5" specularExponent="20" lighting-color="white">
          <fePointLight x="-50" y="60" z="200"/>
        </feSpecularLighting>
        <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut2"/>
        <feComposite in="SourceGraphic" in2="specOut2" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litPaint"/>
      </filter>

      <!-- Soft Glow -->
      <filter id="softGlow">
        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Frosted Glass -->
      <filter id="frostedGlass">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur1" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur2" />
        <feBlend in="blur1" in2="blur2" mode="screen" result="blend" />
        <feColorMatrix in="blend" type="saturate" values="1.2" />
        <feComponentTransfer>
          <feFuncA type="discrete" tableValues="1 1" />
        </feComponentTransfer>
      </filter>
      
      <!-- Chromatic Aberration -->
      <filter id="chromaticAberration">
        <feOffset in="SourceGraphic" dx="1" dy="0" result="r" />
        <feOffset in="SourceGraphic" dx="-1" dy="0" result="b" />
        <feBlend in="r" in2="SourceGraphic" mode="screen" result="rb" />
        <feBlend in="rb" in2="b" mode="screen" />
      </filter>
    </defs>
  </svg>
</div>

<style>
  .liquid-glass-filters {
    position: absolute;
    pointer-events: none;
    width: 0;
    height: 0;
    overflow: hidden;
  }
</style> 
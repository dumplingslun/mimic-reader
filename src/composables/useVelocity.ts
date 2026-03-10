import { ref, computed } from 'vue'

interface VelocityConfig {
  acceleration: number
  friction: number
  maxVelocity: number
  minVelocity: number
  stopThreshold: number
}

const DEFAULT_CONFIG: VelocityConfig = {
  acceleration: 0.5,
  friction: 0.95,
  maxVelocity: 50,
  minVelocity: 0.1,
  stopThreshold: 0.01
}

export function useVelocity(config: Partial<VelocityConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  
  const velocity = ref(0)
  const position = ref(0)
  const isMoving = ref(false)
  const direction = ref<'left' | 'right' | null>(null)
  const lastTimestamp = ref<number>(0)
  const animationFrameId = ref<number | null>(null)
  
  const speed = computed(() => Math.abs(velocity.value))
  const isFast = computed(() => speed.value > cfg.maxVelocity * 0.7)
  
  function accelerate(deltaTime: number = 16) {
    const accel = cfg.acceleration * (deltaTime / 16)
    
    if (direction.value === 'right') {
      velocity.value = Math.min(velocity.value + accel, cfg.maxVelocity)
    } else if (direction.value === 'left') {
      velocity.value = Math.max(velocity.value - accel, -cfg.maxVelocity)
    }
    
    isMoving.value = true
  }
  
  function applyFriction(deltaTime: number = 16) {
    const friction = Math.pow(cfg.friction, deltaTime / 16)
    velocity.value *= friction
    
    if (Math.abs(velocity.value) < cfg.stopThreshold) {
      velocity.value = 0
      isMoving.value = false
      direction.value = null
    }
  }
  
  function update(deltaTime: number = 16) {
    if (direction.value) {
      accelerate(deltaTime)
    } else if (isMoving.value) {
      applyFriction(deltaTime)
    }
    
    position.value += velocity.value
    
    if (isMoving.value && velocity.value === 0) {
      stop()
    }
  }
  
  function startMoving(dir: 'left' | 'right') {
    direction.value = dir
    isMoving.value = true
    lastTimestamp.value = performance.now()
    
    if (!animationFrameId.value) {
      tick()
    }
  }
  
  function stopMoving() {
    direction.value = null
  }
  
  function stop() {
    direction.value = null
    velocity.value = 0
    isMoving.value = false
    
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value)
      animationFrameId.value = null
    }
  }
  
  function setPosition(pos: number) {
    position.value = pos
  }
  
  function setVelocity(vel: number) {
    velocity.value = Math.max(-cfg.maxVelocity, Math.min(cfg.maxVelocity, vel))
    if (vel !== 0) {
      isMoving.value = true
      direction.value = vel > 0 ? 'right' : 'left'
    }
  }
  
  function tick() {
    const now = performance.now()
    const deltaTime = lastTimestamp.value ? now - lastTimestamp.value : 16
    lastTimestamp.value = now
    
    update(deltaTime)
    
    if (isMoving.value || direction.value) {
      animationFrameId.value = requestAnimationFrame(tick)
    } else {
      animationFrameId.value = null
    }
  }
  
  function startAnimationLoop(onUpdate?: (pos: number, vel: number) => void) {
    if (animationFrameId.value) return
    
    function loop() {
      const now = performance.now()
      const deltaTime = lastTimestamp.value ? now - lastTimestamp.value : 16
      lastTimestamp.value = now
      
      update(deltaTime)
      
      if (onUpdate) {
        onUpdate(position.value, velocity.value)
      }
      
      if (isMoving.value || direction.value) {
        animationFrameId.value = requestAnimationFrame(loop)
      } else {
        animationFrameId.value = null
      }
    }
    
    lastTimestamp.value = performance.now()
    loop()
  }
  
  function stopAnimationLoop() {
    if (animationFrameId.value) {
      cancelAnimationFrame(animationFrameId.value)
      animationFrameId.value = null
    }
  }
  
  function reset() {
    stop()
    position.value = 0
    lastTimestamp.value = 0
  }
  
  return {
    velocity,
    position,
    speed,
    isMoving,
    direction,
    isFast,
    startMoving,
    stopMoving,
    stop,
    setPosition,
    setVelocity,
    update,
    startAnimationLoop,
    stopAnimationLoop,
    reset
  }
}

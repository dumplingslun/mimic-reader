import { ref, onMounted } from 'vue'

export type Platform = 'macos' | 'windows' | 'linux' | 'unknown'

export function usePlatform() {
  const platform = ref<Platform>('unknown')
  const isMacOS = ref(false)
  const isWindows = ref(false)
  const isLinux = ref(false)

  onMounted(() => {
    const userAgent = navigator.userAgent.toLowerCase()

    if (userAgent.includes('mac')) {
      platform.value = 'macos'
      isMacOS.value = true
    } else if (userAgent.includes('win')) {
      platform.value = 'windows'
      isWindows.value = true
    } else if (userAgent.includes('linux')) {
      platform.value = 'linux'
      isLinux.value = true
    }
  })

  const getTrafficLightsOffset = (): number => {
    if (isMacOS.value) {
      return 80
    }
    return 0
  }

  const getWindowControlsSide = (): 'left' | 'right' => {
    if (isMacOS.value) {
      return 'left'
    }
    return 'right'
  }

  return {
    platform,
    isMacOS,
    isWindows,
    isLinux,
    getTrafficLightsOffset,
    getWindowControlsSide
  }
}

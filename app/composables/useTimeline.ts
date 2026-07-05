import { reactive } from 'vue'

export interface TimelineState {
  time: number
  duration: number
  playing: boolean
  speed: number
  ready: boolean
}

const state = reactive<TimelineState>({
  time: 0,
  duration: 150,
  playing: true,
  speed: 1,
  ready: false
})

export function useTimeline() {
  return state
}

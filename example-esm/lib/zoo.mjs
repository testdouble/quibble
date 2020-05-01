import lion from './animals/lion.mjs'
import bear from './animals/bear.mjs'

export default function () {
  return {
    animals: [
      lion(),
      bear()
    ]
  }
}

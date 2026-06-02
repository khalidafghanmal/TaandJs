/**
 * Conditional value helpers — when() / unless()
 */
export function when(condition, value, alternative = null) {
  return condition ? value : alternative;
}

export function unless(condition, value, alternative = null) {
  return when(!condition, value, alternative);
}

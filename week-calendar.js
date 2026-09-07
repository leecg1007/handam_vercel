/** 기준일이 속한 주의 월요일 00:00을 현지 시간 기준으로 반환합니다. */
export function getWeekStart(reference = new Date()) {
  const monday = new Date(reference);
  monday.setHours(0, 0, 0, 0);
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  return monday;
}

/** 기준일이 속한 주의 월요일부터 일요일까지를 현지 시간 기준으로 반환합니다. */
export function getWeekStripDates(reference = new Date()) {
  const monday = getWeekStart(reference);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}

export function shiftWeek(reference, amount) {
  const shifted = getWeekStart(reference);
  shifted.setDate(shifted.getDate() + amount * 7);
  return shifted;
}

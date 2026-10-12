export function age(birthDate: string, today = new Date()) {
  const [year, month, day] = birthDate.split('-').map(Number)
  let years = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) years--
  return years
}

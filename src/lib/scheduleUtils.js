// Calcula la semana del año para los turnos rotativos
export function getWeekNumber(d) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  // Jueves en la semana actual decide el año
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

// Default schedule for backwards compatibility if null in DB
export const defaultSchedule = {
  type: 'fixed',
  weekA: {
    1: [[9, 14]],
    2: [[9, 19]],
    3: [[9, 19]],
    4: [[9, 19]],
    5: [[9, 17]],
    6: [[9, 14]],
    0: []
  }
};

// Obtiene el horario de un empleado para un día concreto
export const getStaffScheduleForDate = (person, dateStr, openingDate = null) => {
  const schedule = person.schedule || defaultSchedule;
  if (!schedule.weekA) return [];
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sunday, 1=Monday...

  let weekObj = schedule.weekA;
  if (schedule.type === 'rotating') {
    let isWeekA = true;
    
    if (openingDate) {
      const openD = new Date(openingDate + "T00:00:00");
      // Ajustar al lunes de la semana de apertura
      openD.setDate(openD.getDate() - (openD.getDay() || 7) + 1);
      
      const targetD = new Date(d);
      targetD.setDate(targetD.getDate() - (targetD.getDay() || 7) + 1);
      
      const diffDays = Math.floor((targetD.getTime() - openD.getTime()) / (1000 * 60 * 60 * 24));
      const weekDiff = Math.floor(diffDays / 7);
      
      // Semana 0 = apertura (Week A). Semanas pares = A, impares = B
      isWeekA = (weekDiff % 2 === 0);
    } else {
      const weekNumber = getWeekNumber(d);
      // Semanas impares usan weekA, pares usan weekB (comportamiento por defecto)
      isWeekA = (weekNumber % 2 !== 0);
    }
    
    weekObj = isWeekA ? schedule.weekA : schedule.weekB;
  }

  const rawBlocks = weekObj[day] || [];
  // Convertimos [9, 14] o [9.5, 14.5] -> [9, 0, 14, 0] o [9, 30, 14, 30] para compatibilidad de slots y agenda
  return rawBlocks.map(block => {
    if (block.length === 4) return block;
    const sh = Math.floor(block[0]);
    const sm = Math.round((block[0] % 1) * 60);
    const eh = Math.floor(block[1]);
    const em = Math.round((block[1] % 1) * 60);
    return [sh, sm, eh, em];
  });
}

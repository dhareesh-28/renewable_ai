async function checkFaultDates() {
  const res = await fetch('http://127.0.0.1:8000/api/faults');
  const data = await res.json();
  console.log('Total events:', data.total_events);
  if (data.events && data.events.length > 0) {
    console.log('First 5 fault events:', data.events.slice(0, 5));
  }
}

checkFaultDates().catch(console.error);

import { supabase } from './config/supabase.js';

const emergencyActions = [
  {
    title: 'Police Emergency',
    description: 'Contact the Ghana Police Service for immediate assistance in case of crime or danger.',
    steps: JSON.stringify([
      'Stay calm and find a safe location if possible.',
      'Call the emergency numbers 191 or 112.',
      'Provide your location clearly.',
      'Explain the nature of the emergency.',
      'Follow the instructions given by the operator.'
    ]),
    contact_info: 'Emergency: 191 or 112'
  },
  {
    title: 'Fire Emergency',
    description: 'Contact the Ghana National Fire Service in case of fire or rescue situations.',
    steps: JSON.stringify([
      'Alert others in the vicinity.',
      'Evacuate the building immediately.',
      'Call the fire emergency numbers 192 or 112.',
      'Do not use elevators.',
      'Wait for the fire service at a safe distance.'
    ]),
    contact_info: 'Fire Service: 192 or 112'
  },
  {
    title: 'Medical Emergency',
    description: 'Contact the National Ambulance Service for medical emergencies.',
    steps: JSON.stringify([
      'Call 193 or 112 for an ambulance.',
      'Provide the location and nature of the medical issue.',
      'Perform basic first aid if trained and safe to do so.',
      'Clear the path for the ambulance.',
      'Stay with the patient until help arrives.'
    ]),
    contact_info: 'Ambulance: 193 or 112'
  },
  {
    title: 'Rights During Arrest',
    description: 'Essential steps to take if you are being arrested or detained by the police.',
    steps: JSON.stringify([
      'Ask why you are being arrested.',
      'You have the right to remain silent; anything you say can be used against you.',
      'You have the right to a lawyer immediately.',
      'Do not resist arrest, but do not sign anything without a lawyer.',
      'Request to contact a family member or friend.'
    ]),
    contact_info: 'Legal Aid Commission: +233 302 669 815'
  }
];

async function seedEmergencyActions() {
  console.log('Seeding emergency actions...');

  try {
    for (const action of emergencyActions) {
      // Check if action exists by title
      const { data: existing } = await supabase
        .from('emergency_actions')
        .select('id')
        .eq('title', action.title)
        .single();

      if (existing) {
        console.log(`Updating: ${action.title}`);
        await supabase
          .from('emergency_actions')
          .update(action)
          .eq('id', existing.id);
      } else {
        console.log(`Inserting: ${action.title}`);
        await supabase
          .from('emergency_actions')
          .insert(action);
      }
    }
    console.log('Emergency actions seeded successfully!');
  } catch (err: any) {
    console.error('Unexpected error:', err.message);
  }
}

seedEmergencyActions();

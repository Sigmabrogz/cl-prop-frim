// ===========================================
// DATABASE RESET SCRIPT - Clear all trading data
// ===========================================

import { db } from '../index.js';
import { 
  tradeEvents, 
  trades, 
  orders, 
  positions, 
  tradingAccounts,
  sessions,
  payouts
} from '../schema/index.js';

async function resetTradingData() {
  console.log('Resetting trading data...\n');

  try {
    // Delete in order to respect foreign key constraints
    console.log('Deleting trade events...');
    await db.delete(tradeEvents);
    
    console.log('Deleting trades...');
    await db.delete(trades);
    
    console.log('Deleting orders...');
    await db.delete(orders);
    
    console.log('Deleting positions...');
    await db.delete(positions);
    
    console.log('Deleting payouts...');
    await db.delete(payouts);
    
    console.log('Deleting trading accounts...');
    await db.delete(tradingAccounts);
    
    console.log('Deleting sessions...');
    await db.delete(sessions);

    console.log('\nAll trading data has been cleared!');
    console.log('\nYou can now:');
    console.log('  1. Login with test@propfirm.local / Test123!');
    console.log('  2. Or login with admin@propfirm.local / Admin123!');
    console.log('  3. Create a new trading account from the dashboard');
    console.log('  4. Start trading fresh!\n');
  } catch (error) {
    console.error('Error resetting data:', error);
    throw error;
  }
}

// Run reset
resetTradingData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Reset failed:', error);
    process.exit(1);
  });


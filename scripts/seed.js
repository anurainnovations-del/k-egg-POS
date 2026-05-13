/**
 * K-egg-POS — Firestore Seed Script
 * 
 * Usage:
 *   1. Download your Firebase service account key:
 *      Firebase Console → Project Settings → Service Accounts → Generate New Private Key
 *      Save as: scripts/serviceAccountKey.json
 * 
 *   2. Fill in your projectId below (same as NEXT_PUBLIC_PROJECT_ID in .env)
 * 
 *   3. Run: node scripts/seed.js
 * 
 * This script creates:
 *   - categories (ingredient + menu types)
 *   - branches (1 sample branch)
 *   - ingredients (sample egg-stall ingredients)
 *   - menuItems (sample menu with recipes)
 *   - An admin user document (requires a Firebase Auth UID — see instructions)
 */

const admin = require('firebase-admin');
const serviceAccount = require('../k-egg-89f8f-firebase-adminsdk-fbsvc-7af804a0f6.json');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const PROJECT_ID = serviceAccount.project_id; // auto-read from service account key

// IMPORTANT: After creating your first user in Firebase Auth console,
// paste their UID here to create the admin Firestore document.
const ADMIN_UID = 'UBwOqP6QfbeG6A3vYXU1isQHG3Q2';
const ADMIN_EMAIL = 'superadmin@gmail.com';
const ADMIN_NAME = 'SuperAdmin';
// ─────────────────────────────────────────────────────────────────────────────

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedCollection(collectionName, docs) {
  console.log(`\n📁 Seeding "${collectionName}" (${docs.length} docs)...`);
  const batch = db.batch();
  const ids = [];

  for (const { id, data } of docs) {
    const ref = id ? db.collection(collectionName).doc(id) : db.collection(collectionName).doc();
    batch.set(ref, { ...data, createdAt: now, updatedAt: now });
    ids.push(ref.id);
  }

  await batch.commit();
  console.log(`  ✅ Done. IDs: ${ids.join(', ')}`);
  return ids;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🥚 K-egg-POS Firestore Seed Script`);
  console.log(`   Project: ${PROJECT_ID}\n`);

  // ── 1. Ingredient Categories ─────────────────────────────────────────────
  const [
    catProtein, catLiquid, catDry, catCondi, catPack
  ] = await seedCollection('categories', [
    { id: 'cat-protein', data: { name: 'Protein', color: '#EF4444', type: 'ingredient' } },
    { id: 'cat-liquid', data: { name: 'Liquids', color: '#3B82F6', type: 'ingredient' } },
    { id: 'cat-dry', data: { name: 'Dry Goods', color: '#F59E0B', type: 'ingredient' } },
    { id: 'cat-condi', data: { name: 'Condiments', color: '#10B981', type: 'ingredient' } },
    { id: 'cat-pack', data: { name: 'Packaging', color: '#8B5CF6', type: 'ingredient' } },
    // Menu categories
    { id: 'mcat-eggs', data: { name: 'Egg Dishes', color: '#F59E0B', type: 'menu' } },
    { id: 'mcat-drinks', data: { name: 'Drinks', color: '#3B82F6', type: 'menu' } },
    { id: 'mcat-sides', data: { name: 'Sides', color: '#10B981', type: 'menu' } },
  ]);

  // ── 2. Branch ────────────────────────────────────────────────────────────
  const [branchId] = await seedCollection('branches', [
    {
      id: 'branch-main',
      data: {
        name: 'Main Branch',
        location: 'Cebu City',
        isActive: true,
        imgUrl: '',
      }
    }
  ]);

  const BRANCH_ID = 'branch-main';

  // ── 3. Ingredients ───────────────────────────────────────────────────────
  const ingredientDocs = [
    // Proteins
    { id: 'ing-egg', data: { name: 'Egg', unit: 'pcs', stock: 200, lowStockThreshold: 20, costPerUnit: 8, categoryId: 'cat-protein', branchId: BRANCH_ID, imgUrl: '' } },
    { id: 'ing-hotdog', data: { name: 'Hotdog', unit: 'pcs', stock: 50, lowStockThreshold: 10, costPerUnit: 12, categoryId: 'cat-protein', branchId: BRANCH_ID, imgUrl: '' } },
    { id: 'ing-cheese', data: { name: 'Cheese Slice', unit: 'pcs', stock: 60, lowStockThreshold: 10, costPerUnit: 10, categoryId: 'cat-protein', branchId: BRANCH_ID, imgUrl: '' } },
    // Liquids
    { id: 'ing-oil', data: { name: 'Cooking Oil', unit: 'ml', stock: 2000, lowStockThreshold: 200, costPerUnit: 0.05, categoryId: 'cat-liquid', branchId: BRANCH_ID, imgUrl: '' } },
    { id: 'ing-milk', data: { name: 'Milk', unit: 'ml', stock: 1000, lowStockThreshold: 100, costPerUnit: 0.07, categoryId: 'cat-liquid', branchId: BRANCH_ID, imgUrl: '' } },
    { id: 'ing-water', data: { name: 'Water', unit: 'ml', stock: 5000, lowStockThreshold: 500, costPerUnit: 0.01, categoryId: 'cat-liquid', branchId: BRANCH_ID, imgUrl: '' } },
    // Dry Goods
    { id: 'ing-salt', data: { name: 'Salt', unit: 'g', stock: 500, lowStockThreshold: 50, costPerUnit: 0.01, categoryId: 'cat-dry', branchId: BRANCH_ID, imgUrl: '' } },
    { id: 'ing-pepper', data: { name: 'Black Pepper', unit: 'g', stock: 200, lowStockThreshold: 20, costPerUnit: 0.05, categoryId: 'cat-dry', branchId: BRANCH_ID, imgUrl: '' } },
    { id: 'ing-bread', data: { name: 'Bread Slice', unit: 'pcs', stock: 40, lowStockThreshold: 8, costPerUnit: 5, categoryId: 'cat-dry', branchId: BRANCH_ID, imgUrl: '' } },
    // Condiments
    { id: 'ing-ketchup', data: { name: 'Ketchup', unit: 'ml', stock: 500, lowStockThreshold: 50, costPerUnit: 0.1, categoryId: 'cat-condi', branchId: BRANCH_ID, imgUrl: '' } },
    { id: 'ing-butter', data: { name: 'Butter', unit: 'g', stock: 300, lowStockThreshold: 30, costPerUnit: 0.15, categoryId: 'cat-condi', branchId: BRANCH_ID, imgUrl: '' } },
    // Packaging
    { id: 'ing-box', data: { name: 'Take-out Box', unit: 'pcs', stock: 100, lowStockThreshold: 15, costPerUnit: 3, categoryId: 'cat-pack', branchId: BRANCH_ID, imgUrl: '' } },
    { id: 'ing-wrapper', data: { name: 'Food Wrapper', unit: 'pcs', stock: 200, lowStockThreshold: 20, costPerUnit: 1, categoryId: 'cat-pack', branchId: BRANCH_ID, imgUrl: '' } },
  ];

  await seedCollection('ingredients', ingredientDocs);

  // ── 4. Menu Items (with recipes) ─────────────────────────────────────────
  const menuDocs = [
    {
      id: 'menu-sunny-side',
      data: {
        name: 'Sunny Side Up',
        price: 35,
        categoryId: 'mcat-eggs',
        description: 'Classic fried egg, sunny side up.',
        imgUrl: '',
        branchId: BRANCH_ID,
        isAvailable: true,
        recipe: [
          { ingredientId: 'ing-egg', ingredientName: 'Egg', quantity: 1, unit: 'pcs' },
          { ingredientId: 'ing-oil', ingredientName: 'Cooking Oil', quantity: 15, unit: 'ml' },
          { ingredientId: 'ing-salt', ingredientName: 'Salt', quantity: 1, unit: 'g' },
        ],
      }
    },
    {
      id: 'menu-scrambled',
      data: {
        name: 'Scrambled Eggs',
        price: 45,
        categoryId: 'mcat-eggs',
        description: 'Fluffy scrambled eggs with milk and butter.',
        imgUrl: '',
        branchId: BRANCH_ID,
        isAvailable: true,
        recipe: [
          { ingredientId: 'ing-egg', ingredientName: 'Egg', quantity: 2, unit: 'pcs' },
          { ingredientId: 'ing-milk', ingredientName: 'Milk', quantity: 30, unit: 'ml' },
          { ingredientId: 'ing-butter', ingredientName: 'Butter', quantity: 5, unit: 'g' },
          { ingredientId: 'ing-salt', ingredientName: 'Salt', quantity: 1, unit: 'g' },
          { ingredientId: 'ing-pepper', ingredientName: 'Black Pepper', quantity: 0.5, unit: 'g' },
        ],
      }
    },
    {
      id: 'menu-egg-sandwich',
      data: {
        name: 'Egg Sandwich',
        price: 55,
        categoryId: 'mcat-eggs',
        description: 'Fried egg on bread with ketchup.',
        imgUrl: '',
        branchId: BRANCH_ID,
        isAvailable: true,
        recipe: [
          { ingredientId: 'ing-egg', ingredientName: 'Egg', quantity: 1, unit: 'pcs' },
          { ingredientId: 'ing-bread', ingredientName: 'Bread Slice', quantity: 2, unit: 'pcs' },
          { ingredientId: 'ing-oil', ingredientName: 'Cooking Oil', quantity: 10, unit: 'ml' },
          { ingredientId: 'ing-ketchup', ingredientName: 'Ketchup', quantity: 15, unit: 'ml' },
          { ingredientId: 'ing-wrapper', ingredientName: 'Food Wrapper', quantity: 1, unit: 'pcs' },
        ],
      }
    },
    {
      id: 'menu-cheesy-egg',
      data: {
        name: 'Cheesy Egg',
        price: 60,
        categoryId: 'mcat-eggs',
        description: 'Fried egg topped with melted cheese.',
        imgUrl: '',
        branchId: BRANCH_ID,
        isAvailable: true,
        recipe: [
          { ingredientId: 'ing-egg', ingredientName: 'Egg', quantity: 2, unit: 'pcs' },
          { ingredientId: 'ing-cheese', ingredientName: 'Cheese Slice', quantity: 1, unit: 'pcs' },
          { ingredientId: 'ing-oil', ingredientName: 'Cooking Oil', quantity: 15, unit: 'ml' },
          { ingredientId: 'ing-salt', ingredientName: 'Salt', quantity: 1, unit: 'g' },
        ],
      }
    },
    {
      id: 'menu-hotdog-egg',
      data: {
        name: 'Hotdog & Egg',
        price: 65,
        categoryId: 'mcat-eggs',
        description: 'Pan-fried hotdog with a fried egg.',
        imgUrl: '',
        branchId: BRANCH_ID,
        isAvailable: true,
        recipe: [
          { ingredientId: 'ing-egg', ingredientName: 'Egg', quantity: 1, unit: 'pcs' },
          { ingredientId: 'ing-hotdog', ingredientName: 'Hotdog', quantity: 1, unit: 'pcs' },
          { ingredientId: 'ing-oil', ingredientName: 'Cooking Oil', quantity: 20, unit: 'ml' },
          { ingredientId: 'ing-box', ingredientName: 'Take-out Box', quantity: 1, unit: 'pcs' },
        ],
      }
    },
    {
      id: 'menu-boiled-egg',
      data: {
        name: 'Boiled Egg (2 pcs)',
        price: 25,
        categoryId: 'mcat-eggs',
        description: 'Hard-boiled eggs, ready to eat.',
        imgUrl: '',
        branchId: BRANCH_ID,
        isAvailable: true,
        recipe: [
          { ingredientId: 'ing-egg', ingredientName: 'Egg', quantity: 2, unit: 'pcs' },
          { ingredientId: 'ing-water', ingredientName: 'Water', quantity: 300, unit: 'ml' },
          { ingredientId: 'ing-salt', ingredientName: 'Salt', quantity: 2, unit: 'g' },
        ],
      }
    },
  ];

  await seedCollection('menuItems', menuDocs);

  // ── 5. Admin User Document ────────────────────────────────────────────────
  if (ADMIN_UID && ADMIN_UID !== 'PASTE_YOUR_ADMIN_UID_HERE') {
    await seedCollection('users', [
      {
        id: ADMIN_UID,
        data: {
          name: ADMIN_NAME,
          email: ADMIN_EMAIL,
          isAdmin: true,
          roleAssignments: [],
          isActive: true,
          passwordResetRequired: false,
          twoFactorEnabled: false,
          createdBy: 'seed-script',
        }
      }
    ]);
    console.log(`\n👤 Admin user document created for UID: ${ADMIN_UID}`);
  } else {
    console.log(`\n⚠️  Skipped admin user — set ADMIN_UID in the script first.`);
    console.log(`   Go to Firebase Console → Authentication → Users → copy your user UID.`);
  }

  console.log(`\n🎉 Seed complete! Collections created:`);
  console.log(`   • categories    (ingredient + menu types)`);
  console.log(`   • branches      (1 branch: "Main Branch")`);
  console.log(`   • ingredients   (13 sample ingredients)`);
  console.log(`   • menuItems     (6 egg dishes with recipes)`);
  console.log(`   • users         (admin doc — if UID was set)`);
  console.log(`\n   ✅ You can now log in at http://localhost:3000/login`);

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});

const admin = require('firebase-admin');
const serviceAccount = require('../k-egg-89f8f-firebase-adminsdk-fbsvc-7af804a0f6.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const menuData = {
  "menu": {
    "korean_egg_drop_sandwiches": [
      {
        "product": "Beef Bulgogi",
        "price": 169,
        "ingredients": ["Brioche bread", "Scrambled eggs", "Marinated beef bulgogi", "K-Egg special sauce", "Parsley"]
      },
      {
        "product": "Spicy Beef Bulgogi",
        "price": 169,
        "ingredients": ["Brioche bread", "Scrambled eggs", "Spicy marinated beef", "Gochujang mayo", "K-Egg special sauce"]
      },
      {
        "product": "Pork Bulgogi",
        "price": 159,
        "ingredients": ["Brioche bread", "Scrambled eggs", "Sweet soy pork", "K-Egg special sauce", "Cheddar cheese"]
      },
      {
        "product": "Spicy Pork Bulgogi",
        "price": 159,
        "ingredients": ["Brioche bread", "Scrambled eggs", "Spicy pork stir-fry", "Chili flakes", "K-Egg special sauce"]
      },
      {
        "product": "Chicken Katsu",
        "price": 159,
        "ingredients": ["Brioche bread", "Scrambled eggs", "Breaded chicken cutlet", "Tonkatsu sauce", "Cabbage slaw"]
      },
      {
        "product": "Chicken Pesto",
        "price": 159,
        "ingredients": ["Brioche bread", "Scrambled eggs", "Grilled chicken", "Basil pesto sauce", "Mayonnaise"]
      },
      {
        "product": "Bacon",
        "price": 149,
        "ingredients": ["Brioche bread", "Scrambled eggs", "Smoked bacon strips", "Cheddar cheese", "K-Egg special sauce"]
      },
      {
        "product": "Ham",
        "price": 149,
        "ingredients": ["Brioche bread", "Scrambled eggs", "Premium sliced ham", "Cheddar cheese", "K-Egg special sauce"]
      },
      {
        "product": "Spam",
        "price": 149,
        "ingredients": ["Brioche bread", "Scrambled eggs", "Grilled Spam slice", "Nori", "K-Egg special sauce"]
      },
      {
        "product": "Classic Toast",
        "price": 109,
        "ingredients": ["Brioche bread", "Scrambled eggs", "Cheddar cheese", "K-Egg special sauce"]
      }
    ],
    "korean_rice_bowls": [
      {
        "product": "Bacon / Ham / Spam Rice Bowl",
        "price": 119,
        "ingredients": ["Steamed rice", "Choice of protein (Bacon/Ham/Spam)", "Fried egg", "Furikake", "Sesame oil"]
      },
      {
        "product": "Chicken Katsu Rice Bowl",
        "price": 149,
        "ingredients": ["Steamed rice", "Chicken katsu", "Egg garnish", "Katsu sauce", "Shredded cabbage"]
      },
      {
        "product": "Beef Bulgogi / Spicy Beef Bulgogi Rice Bowl",
        "price": 149,
        "ingredients": ["Steamed rice", "Marinated beef", "Sesame seeds", "Onions", "Pickled radish"]
      },
      {
        "product": "Pork Bulgogi / Spicy Pork Bulgogi Rice Bowl",
        "price": 149,
        "ingredients": ["Steamed rice", "Marinated pork", "Spring onions", "Kimchi", "Sesame seeds"]
      }
    ],
    "korean_corndogs": [
      {
        "product": "Classic Corndog",
        "price": 119,
        "ingredients": ["Sausage", "Sweet flour batter", "Sugar coating", "Ketchup/Mustard"]
      },
      {
        "product": "Ramyeon Corndog",
        "price": 129,
        "ingredients": ["Sausage", "Crushed ramyeon noodles", "Sweet batter", "Spicy seasoning"]
      },
      {
        "product": "Potato Corndog",
        "price": 129,
        "ingredients": ["Sausage", "Diced potatoes", "Sweet batter", "Sugar"]
      },
      {
        "product": "Mozzadog",
        "price": 139,
        "ingredients": ["Mozzarella cheese block", "Sweet batter", "Breadcrumbs"]
      },
      {
        "product": "Mozza Spam",
        "price": 149,
        "ingredients": ["Spam", "Mozzarella cheese", "Sweet batter", "Breadcrumbs"]
      }
    ],
    "sandwich_meals": [
      {
        "product": "Full Sandwich Meal",
        "price": 250,
        "description": "Customizable combo",
        "ingredients": ["Choice of Eggdrop Sandwich", "Choice of Corndog", "Iced Americano"]
      }
    ]
  }
};

async function clearCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`Cleared collection: ${collectionName}`);
}

async function main() {
  console.log("Starting database re-seed...");

  // 1. Clear existing data
  await clearCollection('orders');
  await clearCollection('menuItems');
  await clearCollection('ingredients');
  await clearCollection('categories');

  const BRANCH_ID = 'branch-main'; // Consistent with seed.js
  const now = admin.firestore.FieldValue.serverTimestamp();

  // 2. Extract unique ingredients
  const uniqueIngredients = new Set();
  Object.values(menuData.menu).forEach(categoryItems => {
    categoryItems.forEach(item => {
      item.ingredients.forEach(ing => uniqueIngredients.add(ing));
    });
  });

  console.log(`Found ${uniqueIngredients.size} unique ingredients.`);

  // 3. Create Ingredient Category
  const ingCatRef = db.collection('categories').doc('cat-ingredients');
  await ingCatRef.set({
    name: 'Main Ingredients',
    color: '#3B82F6',
    type: 'ingredient',
    createdAt: now,
    updatedAt: now
  });

  // 4. Create Ingredients
  const ingredientMap = {}; // name -> id
  const ingBatch = db.batch();
  uniqueIngredients.forEach(ingName => {
    const ref = db.collection('ingredients').doc();
    ingBatch.set(ref, {
      name: ingName,
      unit: 'unit',
      stock: 1000,
      lowStockThreshold: 10,
      costPerUnit: 0,
      categoryId: 'cat-ingredients',
      branchId: BRANCH_ID,
      imgUrl: '',
      createdAt: now,
      updatedAt: now
    });
    ingredientMap[ingName] = ref.id;
  });
  await ingBatch.commit();
  console.log("Ingredients seeded.");

  // 5. Create Menu Categories and Items
  for (const [key, items] of Object.entries(menuData.menu)) {
    const catName = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    const catId = `mcat-${key}`;
    
    await db.collection('categories').doc(catId).set({
      name: catName,
      color: '#F59E0B',
      type: 'menu',
      createdAt: now,
      updatedAt: now
    });

    const menuBatch = db.batch();
    items.forEach(item => {
      const ref = db.collection('menuItems').doc();
      const recipe = item.ingredients.map(ingName => ({
        ingredientId: ingredientMap[ingName],
        ingredientName: ingName,
        quantity: 1,
        unit: 'unit'
      }));

      menuBatch.set(ref, {
        name: item.product,
        price: item.price || 0,
        categoryId: catId,
        description: item.description || `Delicious ${item.product}`,
        imgUrl: '',
        branchId: BRANCH_ID,
        isAvailable: true,
        recipe: recipe,
        createdAt: now,
        updatedAt: now
      });
    });
    await menuBatch.commit();
    console.log(`Seeded category: ${catName}`);
  }

  console.log("Database re-seed complete!");
  process.exit(0);
}

main().catch(err => {
  console.error("Re-seed failed:", err);
  process.exit(1);
});

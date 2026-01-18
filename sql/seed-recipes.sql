-- Seed Data: Swedish Recipes for Meal Planner
-- Run this in Supabase SQL Editor to populate initial recipes

INSERT INTO recipes (source, name, url, image_url, description, ingredients, instructions, features, prep_time_minutes, cook_time_minutes, total_time_minutes, servings, external_rating, external_rating_count) VALUES

-- Swedish Classics
('seed', 'Köttbullar med gräddsås', 'https://www.arla.se/recept/kottbullar/', 'https://images.arla.com/recordid/2D5765F4-B9CE-4C39-B7D5E587C223671B/kottbullar-med-graddsas.jpg', 'Klassiska svenska köttbullar med krämig gräddsås och lingonsylt.', 
'[{"amount": "500g", "ingredient": "blandfärs"}, {"amount": "1", "ingredient": "ägg"}, {"amount": "1 dl", "ingredient": "ströbröd"}, {"amount": "1", "ingredient": "gul lök"}, {"amount": "2 dl", "ingredient": "grädde"}, {"amount": "2 dl", "ingredient": "mjölk"}, {"amount": "2 msk", "ingredient": "smör"}, {"amount": "2 msk", "ingredient": "vetemjöl"}, {"amount": "3 dl", "ingredient": "buljongtärning"}]',
'{"Blanda färs, ägg, ströbröd och hackad lök", "Forma till bollar", "Stek i smör tills genomstekta", "Gör sås av smör, mjöl och buljong", "Tillsätt grädde och koka ihop"}',
'{"cuisine": "swedish", "protein": ["beef", "pork"], "spice_level": "mild", "prep_time_bucket": "medium", "ingredients": ["blandfärs", "ägg", "grädde", "lök", "ströbröd"]}',
20, 25, 45, '4 portioner', 4.7, 2341),

('seed', 'Pannkakor', 'https://www.arla.se/recept/pannkakor/', 'https://images.arla.com/recordid/FB7C10AA-7E44-4BDE-8C5B0B1AAE8D7F84/pannkakor.jpg', 'Fluffiga svenska pannkakor med sylt och grädde.',
'[{"amount": "3 dl", "ingredient": "vetemjöl"}, {"amount": "6 dl", "ingredient": "mjölk"}, {"amount": "3", "ingredient": "ägg"}, {"amount": "1 msk", "ingredient": "smör"}, {"amount": "1 nypa", "ingredient": "salt"}]',
'{"Vispa ihop mjöl och hälften av mjölken", "Tillsätt resten av mjölken och äggen", "Låt vila 10 minuter", "Stek tunna pannkakor i smör", "Servera med sylt och grädde"}',
'{"cuisine": "swedish", "protein": ["egg"], "carb": "flour", "spice_level": "mild", "prep_time_bucket": "quick", "ingredients": ["vetemjöl", "mjölk", "ägg", "smör"]}',
10, 15, 25, '4 portioner', 4.8, 3892),

('seed', 'Falukorv Stroganoff', 'https://www.arla.se/recept/falukorv-stroganoff/', 'https://images.arla.com/recordid/F9D4E641-3D89-4CF2-B33B43B5C82E6D90/falukorv-stroganoff.jpg', 'Krämig stroganoff med falukorv - en svensk favorit.',
'[{"amount": "400g", "ingredient": "falukorv"}, {"amount": "1", "ingredient": "gul lök"}, {"amount": "2 msk", "ingredient": "tomatpuré"}, {"amount": "2 dl", "ingredient": "grädde"}, {"amount": "1 dl", "ingredient": "vatten"}, {"amount": "1 msk", "ingredient": "soja"}, {"amount": "1 tsk", "ingredient": "dijonsenap"}]',
'{"Skär falukorv i stavar", "Fräs lök i smör", "Tillsätt tomatpuré och falukorv", "Häll i grädde och vatten", "Smaksätt med soja och senap"}',
'{"cuisine": "swedish", "protein": ["pork"], "spice_level": "mild", "prep_time_bucket": "quick", "ingredients": ["falukorv", "grädde", "tomatpuré", "lök"]}',
10, 15, 25, '4 portioner', 4.5, 1823),

('seed', 'Raggmunk med fläsk', 'https://www.arla.se/recept/raggmunk/', 'https://images.arla.com/recordid/A9D4E741-3D89-4CF2-B33B43B5C82E6D91/raggmunk.jpg', 'Krispiga raggmunkar med stekt fläsk och lingon.',
'[{"amount": "6", "ingredient": "potatisar"}, {"amount": "2 dl", "ingredient": "vetemjöl"}, {"amount": "4 dl", "ingredient": "mjölk"}, {"amount": "2", "ingredient": "ägg"}, {"amount": "200g", "ingredient": "sidfläsk"}, {"amount": "1 dl", "ingredient": "lingonsylt"}]',
'{"Riv potatisen grovt", "Blanda med mjöl, mjölk och ägg", "Stek fläsket krispigt", "Stek raggmunkar i fläskfett", "Servera med fläsk och lingon"}',
'{"cuisine": "swedish", "protein": ["pork", "egg"], "carb": "potato", "spice_level": "mild", "prep_time_bucket": "medium", "ingredients": ["potatis", "sidfläsk", "mjölk", "ägg", "lingon"]}',
20, 20, 40, '4 portioner', 4.6, 1456),

-- Pasta dishes
('seed', 'Pasta Carbonara', 'https://www.arla.se/recept/pasta-carbonara/', 'https://images.arla.com/recordid/B8D5E742-4E8A-5DF3-C44C54C6D93F7E92/pasta-carbonara.jpg', 'Krämig italiensk pasta med ägg, bacon och parmesan.',
'[{"amount": "400g", "ingredient": "spaghetti"}, {"amount": "200g", "ingredient": "bacon"}, {"amount": "4", "ingredient": "äggulor"}, {"amount": "1 dl", "ingredient": "parmesan"}, {"amount": "2 dl", "ingredient": "grädde"}, {"amount": "2 klyftor", "ingredient": "vitlök"}]',
'{"Koka pastan", "Stek bacon krispigt", "Vispa äggulor, parmesan och grädde", "Blanda het pasta med baconet", "Rör ner äggblandningen och servera direkt"}',
'{"cuisine": "italian", "protein": ["pork", "egg"], "carb": "pasta", "spice_level": "mild", "prep_time_bucket": "quick", "ingredients": ["spaghetti", "bacon", "äggula", "parmesan", "grädde"]}',
10, 15, 25, '4 portioner', 4.8, 2987),

('seed', 'Lasagne', 'https://www.arla.se/recept/lasagne/', 'https://images.arla.com/recordid/C9E6F853-5F9B-6EG4-D55D65D7EA4G8F03/lasagne.jpg', 'Klassisk lasagne med köttfärssås och krämig béchamel.',
'[{"amount": "500g", "ingredient": "nötfärs"}, {"amount": "1 burk", "ingredient": "krossade tomater"}, {"amount": "1", "ingredient": "gul lök"}, {"amount": "2 klyftor", "ingredient": "vitlök"}, {"amount": "5 dl", "ingredient": "mjölk"}, {"amount": "3 msk", "ingredient": "smör"}, {"amount": "3 msk", "ingredient": "vetemjöl"}, {"amount": "1 paket", "ingredient": "lasagneplattor"}, {"amount": "2 dl", "ingredient": "riven ost"}]',
'{"Stek färs och lök", "Tillsätt tomater och låt sjuda", "Gör béchamelsås av smör, mjöl och mjölk", "Varva köttfärssås, béchamel och plattor", "Toppa med ost och gratinera i ugn"}',
'{"cuisine": "italian", "protein": ["beef"], "carb": "pasta", "spice_level": "mild", "prep_time_bucket": "long", "ingredients": ["nötfärs", "tomater", "lasagneplattor", "ost", "mjölk"]}',
30, 45, 75, '6 portioner', 4.7, 3456),

('seed', 'Pasta med räkor och vitlök', 'https://www.arla.se/recept/pasta-rakor/', 'https://images.arla.com/recordid/D0F7G964-6G0C-7FH5-E66E76E8FB5H9G14/pasta-rakor.jpg', 'Snabb pasta med vitlöksfrästa räkor och citron.',
'[{"amount": "400g", "ingredient": "linguine"}, {"amount": "300g", "ingredient": "räkor"}, {"amount": "4 klyftor", "ingredient": "vitlök"}, {"amount": "1 dl", "ingredient": "olivolja"}, {"amount": "1", "ingredient": "citron"}, {"amount": "1 dl", "ingredient": "persilja"}, {"amount": "1 krm", "ingredient": "chili"}]',
'{"Koka pastan", "Fräs vitlök i olivolja", "Tillsätt räkor och chili", "Blanda med pastan", "Toppa med citron och persilja"}',
'{"cuisine": "italian", "protein": ["shrimp"], "carb": "pasta", "spice_level": "medium", "prep_time_bucket": "quick", "ingredients": ["linguine", "räkor", "vitlök", "citron", "olivolja"]}',
10, 12, 22, '4 portioner', 4.6, 1234),

-- Chicken dishes
('seed', 'Kycklinggryta med curry', 'https://www.arla.se/recept/kycklinggryta-curry/', 'https://images.arla.com/recordid/E1G8H075-7H1D-8GI6-F77F87F9GC6I0H25/kycklinggryta-curry.jpg', 'Krämig kycklinggryta med mild curry och ris.',
'[{"amount": "600g", "ingredient": "kycklingfilé"}, {"amount": "1", "ingredient": "gul lök"}, {"amount": "2 msk", "ingredient": "curry"}, {"amount": "4 dl", "ingredient": "kokosmjölk"}, {"amount": "1 dl", "ingredient": "créme fraiche"}, {"amount": "1", "ingredient": "röd paprika"}, {"amount": "4 dl", "ingredient": "ris"}]',
'{"Skär kycklingen i bitar", "Fräs lök och paprika", "Tillsätt kyckling och curry", "Häll i kokosmjölk och låt sjuda", "Rör ner créme fraiche och servera med ris"}',
'{"cuisine": "indian", "protein": ["chicken"], "carb": "rice", "spice_level": "medium", "prep_time_bucket": "medium", "ingredients": ["kyckling", "curry", "kokosmjölk", "paprika", "ris"]}',
15, 25, 40, '4 portioner', 4.5, 2109),

('seed', 'Ugnsstekt kyckling med rosmarin', 'https://www.arla.se/recept/ugnsstekt-kyckling/', 'https://images.arla.com/recordid/F2H9I186-8I2E-9HJ7-G88G98G0HD7J1I36/ugnsstekt-kyckling.jpg', 'Saftig hel kyckling med rosmarin och citron.',
'[{"amount": "1 hel", "ingredient": "kyckling"}, {"amount": "4 kvistar", "ingredient": "rosmarin"}, {"amount": "1", "ingredient": "citron"}, {"amount": "4", "ingredient": "vitlöksklyftor"}, {"amount": "3 msk", "ingredient": "olivolja"}, {"amount": "1 kg", "ingredient": "potatis"}]',
'{"Gnid in kycklingen med olja och kryddor", "Stoppa citron och rosmarin i kycklingen", "Lägg potatis runt om", "Stek i ugn 200°C i ca 1 timme", "Låt vila innan servering"}',
'{"cuisine": "swedish", "protein": ["chicken"], "carb": "potato", "spice_level": "mild", "prep_time_bucket": "long", "ingredients": ["kyckling", "rosmarin", "citron", "vitlök", "potatis"]}',
15, 60, 75, '4 portioner', 4.7, 1876),

('seed', 'Kyckling med pesto och mozzarella', 'https://www.arla.se/recept/kyckling-pesto/', 'https://images.arla.com/recordid/G3I0J297-9J3F-0IK8-H99H09H1IE8K2J47/kyckling-pesto.jpg', 'Gratinerad kycklingfilé med pesto och smält mozzarella.',
'[{"amount": "4", "ingredient": "kycklingfiléer"}, {"amount": "4 msk", "ingredient": "pesto"}, {"amount": "1 kula", "ingredient": "mozzarella"}, {"amount": "2", "ingredient": "tomater"}, {"amount": "1 dl", "ingredient": "basilika"}]',
'{"Skåra kycklingfiléerna", "Bred på pesto", "Lägg på tomatskivor och mozzarella", "Gratinera i ugn 200°C i 25 min", "Toppa med färsk basilika"}',
'{"cuisine": "italian", "protein": ["chicken"], "spice_level": "mild", "prep_time_bucket": "medium", "ingredients": ["kyckling", "pesto", "mozzarella", "tomat", "basilika"]}',
10, 25, 35, '4 portioner', 4.6, 2543),

-- Fish dishes
('seed', 'Laxfile med dillsås', 'https://www.arla.se/recept/lax-dillsas/', 'https://images.arla.com/recordid/H4J1K308-0K4G-1JL9-I00I10I2JF9L3K58/lax-dillsas.jpg', 'Ugnsbakad lax med krämig dillsås.',
'[{"amount": "600g", "ingredient": "laxfilé"}, {"amount": "3 dl", "ingredient": "grädde"}, {"amount": "1 dl", "ingredient": "hackad dill"}, {"amount": "1 msk", "ingredient": "dijonsenap"}, {"amount": "1", "ingredient": "citron"}]',
'{"Lägg laxen i ugnsform", "Vispa grädde, dill och senap", "Häll såsen över laxen", "Baka i ugn 175°C i 25 min", "Servera med citron och kokt potatis"}',
'{"cuisine": "swedish", "protein": ["salmon"], "spice_level": "mild", "prep_time_bucket": "medium", "ingredients": ["lax", "grädde", "dill", "senap", "citron"]}',
10, 25, 35, '4 portioner', 4.6, 1987),

('seed', 'Fish and chips', 'https://www.arla.se/recept/fish-and-chips/', 'https://images.arla.com/recordid/I5K2L419-1L5H-2KM0-J11J21J3KG0M4L69/fish-and-chips.jpg', 'Krispig friterad fisk med pommes frites.',
'[{"amount": "600g", "ingredient": "torskfilé"}, {"amount": "2 dl", "ingredient": "vetemjöl"}, {"amount": "3 dl", "ingredient": "öl"}, {"amount": "1 kg", "ingredient": "potatis"}, {"amount": "1 l", "ingredient": "olja"}]',
'{"Gör smet av mjöl och öl", "Skär potatis i stavar och fritera", "Doppa fisken i smeten", "Fritera fisken gyllene", "Servera med pommes och remouladsås"}',
'{"cuisine": "british", "protein": ["cod"], "carb": "potato", "spice_level": "mild", "prep_time_bucket": "medium", "ingredients": ["torsk", "potatis", "öl", "vetemjöl"]}',
20, 20, 40, '4 portioner', 4.4, 1234),

-- Mexican
('seed', 'Tacos med köttfärs', 'https://www.arla.se/recept/tacos/', 'https://images.arla.com/recordid/J6L3M520-2M6I-3LN1-K22K32K4LH1N5M70/tacos.jpg', 'Mexikanska tacos med kryddig köttfärs och alla tillbehör.',
'[{"amount": "500g", "ingredient": "nötfärs"}, {"amount": "1 påse", "ingredient": "tacokrydda"}, {"amount": "8", "ingredient": "tacoskal"}, {"amount": "1", "ingredient": "tomat"}, {"amount": "1", "ingredient": "rödlök"}, {"amount": "1", "ingredient": "avokado"}, {"amount": "2 dl", "ingredient": "riven ost"}, {"amount": "2 dl", "ingredient": "gräddfil"}]',
'{"Stek köttfärsen", "Tillsätt tacokrydda och vatten", "Hacka tomat, lök och avokado", "Värm tacoskalen", "Fyll med färs och tillbehör"}',
'{"cuisine": "mexican", "protein": ["beef"], "spice_level": "medium", "prep_time_bucket": "quick", "ingredients": ["nötfärs", "tacokrydda", "tomat", "avokado", "ost"]}',
15, 10, 25, '4 portioner', 4.7, 4521),

('seed', 'Burrito bowl', 'https://www.arla.se/recept/burrito-bowl/', 'https://images.arla.com/recordid/K7M4N631-3N7J-4MO2-L33L43L5MI2O6N81/burrito-bowl.jpg', 'Färgglad burrito bowl med kyckling, ris och bönor.',
'[{"amount": "500g", "ingredient": "kycklingfilé"}, {"amount": "4 dl", "ingredient": "ris"}, {"amount": "1 burk", "ingredient": "svarta bönor"}, {"amount": "1 burk", "ingredient": "majs"}, {"amount": "2", "ingredient": "avokado"}, {"amount": "2 dl", "ingredient": "salsa"}, {"amount": "2 dl", "ingredient": "gräddfil"}, {"amount": "1", "ingredient": "lime"}]',
'{"Koka riset", "Stek kycklingen med kryddor", "Skölj bönor och majs", "Skiva avokado", "Lägg upp i skålar och toppa med salsa och gräddfil"}',
'{"cuisine": "mexican", "protein": ["chicken"], "carb": "rice", "spice_level": "medium", "prep_time_bucket": "medium", "ingredients": ["kyckling", "ris", "svarta bönor", "avokado", "salsa"]}',
15, 20, 35, '4 portioner', 4.6, 2345),

-- Asian
('seed', 'Wok med kyckling och grönsaker', 'https://www.arla.se/recept/kyckling-wok/', 'https://images.arla.com/recordid/L8N5O742-4O8K-5NP3-M44M54M6NJ3P7O92/kyckling-wok.jpg', 'Snabb och nyttig wok med kyckling och färska grönsaker.',
'[{"amount": "500g", "ingredient": "kycklingfilé"}, {"amount": "1", "ingredient": "broccoli"}, {"amount": "2", "ingredient": "morötter"}, {"amount": "1", "ingredient": "röd paprika"}, {"amount": "3 msk", "ingredient": "sojasås"}, {"amount": "2 msk", "ingredient": "sesamolja"}, {"amount": "2 klyftor", "ingredient": "vitlök"}, {"amount": "1 bit", "ingredient": "ingefära"}]',
'{"Skär kyckling och grönsaker i bitar", "Hetta upp olja i wok", "Stek kycklingen först", "Tillsätt grönsaker och soja", "Servera med ris eller nudlar"}',
'{"cuisine": "asian", "protein": ["chicken"], "spice_level": "mild", "prep_time_bucket": "quick", "ingredients": ["kyckling", "broccoli", "paprika", "sojasås", "ingefära"]}',
15, 10, 25, '4 portioner', 4.5, 2876),

('seed', 'Pad Thai', 'https://www.arla.se/recept/pad-thai/', 'https://images.arla.com/recordid/M9O6P853-5P9L-6OQ4-N55N65N7OK4Q8P03/pad-thai.jpg', 'Klassisk thailändsk nudelrätt med räkor och jordnötter.',
'[{"amount": "300g", "ingredient": "risnudlar"}, {"amount": "300g", "ingredient": "räkor"}, {"amount": "2", "ingredient": "ägg"}, {"amount": "2 dl", "ingredient": "böngroddar"}, {"amount": "3 msk", "ingredient": "fisksås"}, {"amount": "2 msk", "ingredient": "tamarind"}, {"amount": "1 dl", "ingredient": "jordnötter"}, {"amount": "2", "ingredient": "lime"}]',
'{"Blötlägg nudlarna", "Stek räkor och ägg", "Tillsätt nudlar och sås", "Vänd ner böngroddar", "Toppa med jordnötter och lime"}',
'{"cuisine": "asian", "protein": ["shrimp", "egg"], "carb": "noodles", "spice_level": "medium", "prep_time_bucket": "quick", "ingredients": ["risnudlar", "räkor", "jordnötter", "böngroddar", "lime"]}',
15, 10, 25, '4 portioner', 4.7, 1987),

-- Vegetarian
('seed', 'Vegetarisk pasta med svamp', 'https://www.arla.se/recept/pasta-svamp/', 'https://images.arla.com/recordid/N0P7Q964-6Q0M-7PR5-O66O76O8PL5R9Q14/pasta-svamp.jpg', 'Krämig pasta med champinjoner och parmesan.',
'[{"amount": "400g", "ingredient": "tagliatelle"}, {"amount": "400g", "ingredient": "champinjoner"}, {"amount": "2 dl", "ingredient": "grädde"}, {"amount": "1 dl", "ingredient": "parmesan"}, {"amount": "2 klyftor", "ingredient": "vitlök"}, {"amount": "1 dl", "ingredient": "persilja"}]',
'{"Koka pastan", "Stek svamp och vitlök", "Tillsätt grädde", "Blanda med pastan", "Toppa med parmesan och persilja"}',
'{"cuisine": "italian", "protein": ["mushroom"], "carb": "pasta", "spice_level": "mild", "prep_time_bucket": "quick", "ingredients": ["tagliatelle", "champinjoner", "grädde", "parmesan", "vitlök"]}',
10, 15, 25, '4 portioner', 4.5, 1654),

('seed', 'Halloumisallad', 'https://www.arla.se/recept/halloumisallad/', 'https://images.arla.com/recordid/O1Q8R075-7R1N-8QS6-P77P87P9QM6S0R25/halloumisallad.jpg', 'Fräsch sallad med stekt halloumi och granatäpple.',
'[{"amount": "2 paket", "ingredient": "halloumi"}, {"amount": "200g", "ingredient": "babyspenat"}, {"amount": "1", "ingredient": "granatäpple"}, {"amount": "1 dl", "ingredient": "valnötter"}, {"amount": "3 msk", "ingredient": "olivolja"}, {"amount": "1 msk", "ingredient": "honung"}, {"amount": "1", "ingredient": "citron"}]',
'{"Skär halloumin i skivor", "Stek halloumin gyllene", "Blanda spenat, granatäpple och nötter", "Gör dressing av olja, honung och citron", "Lägg halloumin på salladen"}',
'{"cuisine": "mediterranean", "protein": ["cheese"], "spice_level": "mild", "prep_time_bucket": "quick", "ingredients": ["halloumi", "spenat", "granatäpple", "valnötter"]}',
10, 10, 20, '4 portioner', 4.6, 2109),

-- Quick meals
('seed', 'Toast Skagen', 'https://www.arla.se/recept/toast-skagen/', 'https://images.arla.com/recordid/P2R9S186-8S2O-9RT7-Q88Q98Q0RN7T1S36/toast-skagen.jpg', 'Klassisk svensk räktoast med rom och dill.',
'[{"amount": "400g", "ingredient": "handskalade räkor"}, {"amount": "2 dl", "ingredient": "majonnäs"}, {"amount": "2 dl", "ingredient": "créme fraiche"}, {"amount": "1 dl", "ingredient": "dill"}, {"amount": "4 skivor", "ingredient": "bröd"}, {"amount": "1 burk", "ingredient": "löjrom"}, {"amount": "1", "ingredient": "citron"}]',
'{"Blanda räkor med majonnäs och créme fraiche", "Hacka dill och rör i", "Rosta brödet", "Lägg räkröran på brödet", "Toppa med löjrom och dill"}',
'{"cuisine": "swedish", "protein": ["shrimp"], "carb": "bread", "spice_level": "mild", "prep_time_bucket": "quick", "ingredients": ["räkor", "majonnäs", "dill", "löjrom", "bröd"]}',
15, 5, 20, '4 portioner', 4.7, 1876),

('seed', 'Omelett med ost och skinka', 'https://www.arla.se/recept/omelett/', 'https://images.arla.com/recordid/Q3S0T297-9T3P-0SU8-R99R09R1SO8U2T47/omelett.jpg', 'Fluffig omelett fylld med ost och skinka.',
'[{"amount": "6", "ingredient": "ägg"}, {"amount": "1 dl", "ingredient": "mjölk"}, {"amount": "1 dl", "ingredient": "riven ost"}, {"amount": "100g", "ingredient": "skinka"}, {"amount": "2 msk", "ingredient": "smör"}, {"amount": "1 dl", "ingredient": "gräslök"}]',
'{"Vispa ägg och mjölk", "Hetta upp smör i stekpanna", "Häll i äggsmeten", "Lägg på ost och skinka när den stelnat", "Vik ihop och servera"}',
'{"cuisine": "french", "protein": ["egg", "ham"], "spice_level": "mild", "prep_time_bucket": "quick", "ingredients": ["ägg", "ost", "skinka", "mjölk"]}',
5, 10, 15, '2 portioner', 4.4, 1543);

-- Verify insert
SELECT COUNT(*) as recipe_count FROM recipes;

-- Migration 043: Seed realistic comments on existing caregiver todos
-- Adds conversational comments simulating real collaborative exchanges between caregivers

BEGIN;

-- ============================================================
-- Members (for reference):
-- Ben Cohen Solal (caregiver): ca2ae7c3-7d4c-4584-a94c-f6e65547121e
-- Alice Caregiver:             cb00b29a-587c-4244-bc34-45691e3d67fe
-- ============================================================

-- ── Comments on "Prendre RDV plombier" (pending, high) ──────
INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
  (gen_random_uuid(), 'a3bcf46c-6006-47ae-ac57-32f14fc8144e',
   'cb00b29a-587c-4244-bc34-45691e3d67fe',
   'Le robinet de la cuisine fuit de plus en plus, il faudrait vraiment s''en occuper rapidement.',
   NOW() - INTERVAL '4 days 6 hours'),

  (gen_random_uuid(), 'a3bcf46c-6006-47ae-ac57-32f14fc8144e',
   'ca2ae7c3-7d4c-4584-a94c-f6e65547121e',
   'J''ai essayé d''appeler Dupuis Plomberie ce matin, pas de réponse. Je retente demain.',
   NOW() - INTERVAL '3 days 20 hours'),

  (gen_random_uuid(), 'a3bcf46c-6006-47ae-ac57-32f14fc8144e',
   'cb00b29a-587c-4244-bc34-45691e3d67fe',
   'Sinon on peut essayer SOS Dépannage, ma voisine les a appelés la semaine dernière et ils sont venus en 48h.',
   NOW() - INTERVAL '3 days 14 hours'),

  (gen_random_uuid(), 'a3bcf46c-6006-47ae-ac57-32f14fc8144e',
   'ca2ae7c3-7d4c-4584-a94c-f6e65547121e',
   'Bonne idée, tu as leur numéro ? En attendant j''ai mis une bassine sous le robinet.',
   NOW() - INTERVAL '3 days 8 hours');


-- ── Comments on "Réparer la Freebox" (in_progress) ──────────
INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
  (gen_random_uuid(), '774c7c80-928a-4623-a7a6-4bc7daa3ba9f',
   'ca2ae7c3-7d4c-4584-a94c-f6e65547121e',
   'Hélène dit que la télé ne marche plus depuis dimanche. J''ai vérifié les câbles, tout semble branché.',
   NOW() - INTERVAL '2 days 18 hours'),

  (gen_random_uuid(), '774c7c80-928a-4623-a7a6-4bc7daa3ba9f',
   'cb00b29a-587c-4244-bc34-45691e3d67fe',
   'J''ai appelé Free, ils disent de débrancher la box 2 minutes puis rebrancher. Je passe essayer ce soir.',
   NOW() - INTERVAL '2 days 10 hours'),

  (gen_random_uuid(), '774c7c80-928a-4623-a7a6-4bc7daa3ba9f',
   'cb00b29a-587c-4244-bc34-45691e3d67fe',
   'Redémarrage fait, ça remarche ! Par contre la télécommande a l''air de ne plus fonctionner, je vais changer les piles demain.',
   NOW() - INTERVAL '1 day 22 hours'),

  (gen_random_uuid(), '774c7c80-928a-4623-a7a6-4bc7daa3ba9f',
   'ca2ae7c3-7d4c-4584-a94c-f6e65547121e',
   'Super merci Alice ! Les piles sont dans le tiroir de la cuisine côté fenêtre.',
   NOW() - INTERVAL '1 day 20 hours');


-- ── Comments on "Acheter pile détecteur de fumée" (completed) ──
INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
  (gen_random_uuid(), '6dc5ab74-5dcf-4879-a914-8b28538e99df',
   'ca2ae7c3-7d4c-4584-a94c-f6e65547121e',
   'Le détecteur bipe toutes les 30 secondes, ça stresse Yves. Tu sais quel type de pile il faut ?',
   NOW() - INTERVAL '6 days'),

  (gen_random_uuid(), '6dc5ab74-5dcf-4879-a914-8b28538e99df',
   'cb00b29a-587c-4244-bc34-45691e3d67fe',
   'C''est une pile 9V carrée. J''en achète demain en passant à Leroy Merlin.',
   NOW() - INTERVAL '5 days 18 hours'),

  (gen_random_uuid(), '6dc5ab74-5dcf-4879-a914-8b28538e99df',
   'cb00b29a-587c-4244-bc34-45691e3d67fe',
   'C''est fait ! Pile changée, j''ai aussi testé le bouton, tout fonctionne.',
   NOW() - INTERVAL '4 days 10 hours');


-- ── Comments on "Commander rampe d'accès salle de bain" (pending) ──
INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
  (gen_random_uuid(), 'cafcea85-323e-43e9-a3f7-2120b21edd6c',
   'ca2ae7c3-7d4c-4584-a94c-f6e65547121e',
   'Le kiné de Hélène recommande une barre d''appui aussi pour les toilettes, on pourrait commander les deux en même temps.',
   NOW() - INTERVAL '3 days 12 hours'),

  (gen_random_uuid(), 'cafcea85-323e-43e9-a3f7-2120b21edd6c',
   'cb00b29a-587c-4244-bc34-45691e3d67fe',
   'J''ai trouvé un kit complet sur Amazon (rampe + barre WC) à 89€, ça a de bonnes notes. Je t''envoie le lien.',
   NOW() - INTERVAL '2 days 22 hours'),

  (gen_random_uuid(), 'cafcea85-323e-43e9-a3f7-2120b21edd6c',
   'ca2ae7c3-7d4c-4584-a94c-f6e65547121e',
   'Parfait, commande-le. On demandera à Lucas s''il peut passer pour l''installer samedi.',
   NOW() - INTERVAL '2 days 16 hours');


-- ── Comments on "Renouveler assurance habitation" (pending) ──
INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
  (gen_random_uuid(), 'c5cafb90-b0ab-469a-9eb9-68db06488fe7',
   'cb00b29a-587c-4244-bc34-45691e3d67fe',
   'Le contrat expire fin avril, on a reçu un courrier de la MAIF avec la proposition de renouvellement.',
   NOW() - INTERVAL '5 days'),

  (gen_random_uuid(), 'c5cafb90-b0ab-469a-9eb9-68db06488fe7',
   'ca2ae7c3-7d4c-4584-a94c-f6e65547121e',
   'OK je m''en occupe. Tu sais si le montant a changé par rapport à l''année dernière ?',
   NOW() - INTERVAL '4 days 14 hours'),

  (gen_random_uuid(), 'c5cafb90-b0ab-469a-9eb9-68db06488fe7',
   'cb00b29a-587c-4244-bc34-45691e3d67fe',
   'Oui il a augmenté de 12€/an. Le courrier est sur la table du salon si tu veux vérifier les garanties.',
   NOW() - INTERVAL '4 days 8 hours');


-- ── Comment on "Trier les papiers du salon" (pending, low) ──
INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
  (gen_random_uuid(), 'f3194b8a-70a2-4de6-9e5f-0f1ad0be1580',
   'ca2ae7c3-7d4c-4584-a94c-f6e65547121e',
   'Il y a une pile de courriers non ouverts depuis 2 semaines. On s''y met ce week-end ?',
   NOW() - INTERVAL '1 day 8 hours');

COMMIT;

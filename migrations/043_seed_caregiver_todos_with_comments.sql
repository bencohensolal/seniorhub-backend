-- Migration 043: Seed caregiver todos with realistic comments
-- Self-contained: creates todos AND comments for the demo household.
-- Uses subqueries so it works on fresh deploys (no hardcoded member IDs).
-- Gracefully skips if the household or members don't exist.

BEGIN;

-- Guard: only run if the demo household has at least 2 non-senior members
DO $$
DECLARE
  v_hid UUID := '04acb333-836e-455d-b2be-685ae0da7f35';
  v_ben UUID;
  v_alice UUID;
BEGIN
  -- Resolve member IDs
  SELECT id INTO v_ben FROM household_members
    WHERE household_id = v_hid AND email = 'ben.cohen.solal@gmail.com' LIMIT 1;
  SELECT id INTO v_alice FROM household_members
    WHERE household_id = v_hid AND first_name = 'Alice' AND role = 'caregiver' LIMIT 1;

  -- Skip entirely if members don't exist
  IF v_ben IS NULL OR v_alice IS NULL THEN
    RAISE NOTICE 'Skipping 043: demo household members not found';
    RETURN;
  END IF;

  -- ═══════════════════════════════════════════════════════════
  -- TODOS (ON CONFLICT DO NOTHING for idempotency)
  -- ═══════════════════════════════════════════════════════════

  INSERT INTO caregiver_todos (id, household_id, title, description, priority, status, assigned_to, due_date, created_by, created_at, updated_at)
  VALUES ('a0000043-0001-0000-0000-000000000001', v_hid,
    'Prendre RDV plombier',
    'Le robinet de la cuisine fuit depuis plusieurs jours.',
    'high', 'pending', v_ben, CURRENT_DATE + 5, v_alice,
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO caregiver_todos (id, household_id, title, description, priority, status, assigned_to, due_date, created_by, created_at, updated_at)
  VALUES ('a0000043-0002-0000-0000-000000000002', v_hid,
    'Réparer la Freebox',
    'La télé ne fonctionne plus depuis dimanche.',
    'normal', 'in_progress', v_alice, NULL, v_ben,
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '6 hours')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO caregiver_todos (id, household_id, title, description, priority, status, assigned_to, due_date, completed_at, completed_by, created_by, created_at, updated_at)
  VALUES ('a0000043-0003-0000-0000-000000000003', v_hid,
    'Acheter pile détecteur de fumée',
    'Le détecteur bipe en continu, pile 9V à remplacer.',
    'high', 'completed', v_alice, CURRENT_DATE - 3,
    NOW() - INTERVAL '4 days', v_alice, v_ben,
    NOW() - INTERVAL '7 days', NOW() - INTERVAL '4 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO caregiver_todos (id, household_id, title, description, priority, status, assigned_to, due_date, created_by, created_at, updated_at)
  VALUES ('a0000043-0004-0000-0000-000000000004', v_hid,
    'Commander rampe d''accès salle de bain',
    'Recommandation du kiné pour sécuriser la salle de bain.',
    'normal', 'pending', v_alice, CURRENT_DATE + 10, v_ben,
    NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO caregiver_todos (id, household_id, title, description, priority, status, assigned_to, due_date, created_by, created_at, updated_at)
  VALUES ('a0000043-0005-0000-0000-000000000005', v_hid,
    'Renouveler assurance habitation',
    'Contrat MAIF expire fin avril, courrier reçu.',
    'normal', 'pending', v_ben, CURRENT_DATE + 15, v_alice,
    NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO caregiver_todos (id, household_id, title, description, priority, status, assigned_to, due_date, created_by, created_at, updated_at)
  VALUES ('a0000043-0006-0000-0000-000000000006', v_hid,
    'Trier les papiers du salon',
    'Pile de courriers non ouverts depuis 2 semaines.',
    'low', 'pending', NULL, NULL, v_ben,
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days')
  ON CONFLICT (id) DO NOTHING;

  -- ═══════════════════════════════════════════════════════════
  -- COMMENTS
  -- ═══════════════════════════════════════════════════════════

  -- Prendre RDV plombier
  INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
    ('c0000043-0001-0000-0000-000000000001', 'a0000043-0001-0000-0000-000000000001', v_alice,
     'Le robinet de la cuisine fuit de plus en plus, il faudrait vraiment s''en occuper rapidement.',
     NOW() - INTERVAL '4 days 6 hours'),
    ('c0000043-0001-0000-0000-000000000002', 'a0000043-0001-0000-0000-000000000001', v_ben,
     'J''ai essayé d''appeler Dupuis Plomberie ce matin, pas de réponse. Je retente demain.',
     NOW() - INTERVAL '3 days 20 hours'),
    ('c0000043-0001-0000-0000-000000000003', 'a0000043-0001-0000-0000-000000000001', v_alice,
     'Sinon on peut essayer SOS Dépannage, ma voisine les a appelés et ils sont venus en 48h.',
     NOW() - INTERVAL '3 days 14 hours'),
    ('c0000043-0001-0000-0000-000000000004', 'a0000043-0001-0000-0000-000000000001', v_ben,
     'Bonne idée, tu as leur numéro ? En attendant j''ai mis une bassine sous le robinet.',
     NOW() - INTERVAL '3 days 8 hours')
  ON CONFLICT (id) DO NOTHING;

  -- Réparer la Freebox
  INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
    ('c0000043-0002-0000-0000-000000000001', 'a0000043-0002-0000-0000-000000000002', v_ben,
     'Hélène dit que la télé ne marche plus depuis dimanche. J''ai vérifié les câbles, tout semble branché.',
     NOW() - INTERVAL '2 days 18 hours'),
    ('c0000043-0002-0000-0000-000000000002', 'a0000043-0002-0000-0000-000000000002', v_alice,
     'J''ai appelé Free, ils disent de débrancher la box 2 minutes puis rebrancher. Je passe essayer ce soir.',
     NOW() - INTERVAL '2 days 10 hours'),
    ('c0000043-0002-0000-0000-000000000003', 'a0000043-0002-0000-0000-000000000002', v_alice,
     'Redémarrage fait, ça remarche ! Par contre la télécommande ne fonctionne plus, je change les piles demain.',
     NOW() - INTERVAL '1 day 22 hours'),
    ('c0000043-0002-0000-0000-000000000004', 'a0000043-0002-0000-0000-000000000002', v_ben,
     'Super merci Alice ! Les piles sont dans le tiroir de la cuisine côté fenêtre.',
     NOW() - INTERVAL '1 day 20 hours')
  ON CONFLICT (id) DO NOTHING;

  -- Acheter pile détecteur de fumée
  INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
    ('c0000043-0003-0000-0000-000000000001', 'a0000043-0003-0000-0000-000000000003', v_ben,
     'Le détecteur bipe toutes les 30 secondes, ça stresse Yves. Tu sais quel type de pile il faut ?',
     NOW() - INTERVAL '6 days'),
    ('c0000043-0003-0000-0000-000000000002', 'a0000043-0003-0000-0000-000000000003', v_alice,
     'C''est une pile 9V carrée. J''en achète demain en passant à Leroy Merlin.',
     NOW() - INTERVAL '5 days 18 hours'),
    ('c0000043-0003-0000-0000-000000000003', 'a0000043-0003-0000-0000-000000000003', v_alice,
     'C''est fait ! Pile changée, j''ai aussi testé le bouton, tout fonctionne.',
     NOW() - INTERVAL '4 days 10 hours')
  ON CONFLICT (id) DO NOTHING;

  -- Commander rampe d'accès salle de bain
  INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
    ('c0000043-0004-0000-0000-000000000001', 'a0000043-0004-0000-0000-000000000004', v_ben,
     'Le kiné de Hélène recommande une barre d''appui aussi pour les toilettes, on pourrait commander les deux.',
     NOW() - INTERVAL '3 days 12 hours'),
    ('c0000043-0004-0000-0000-000000000002', 'a0000043-0004-0000-0000-000000000004', v_alice,
     'J''ai trouvé un kit complet sur Amazon (rampe + barre WC) à 89€ avec de bonnes notes. Je t''envoie le lien.',
     NOW() - INTERVAL '2 days 22 hours'),
    ('c0000043-0004-0000-0000-000000000003', 'a0000043-0004-0000-0000-000000000004', v_ben,
     'Parfait, commande-le. On demandera à Lucas s''il peut passer pour l''installer samedi.',
     NOW() - INTERVAL '2 days 16 hours')
  ON CONFLICT (id) DO NOTHING;

  -- Renouveler assurance habitation
  INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
    ('c0000043-0005-0000-0000-000000000001', 'a0000043-0005-0000-0000-000000000005', v_alice,
     'Le contrat expire fin avril, on a reçu un courrier de la MAIF avec la proposition de renouvellement.',
     NOW() - INTERVAL '5 days'),
    ('c0000043-0005-0000-0000-000000000002', 'a0000043-0005-0000-0000-000000000005', v_ben,
     'OK je m''en occupe. Tu sais si le montant a changé par rapport à l''année dernière ?',
     NOW() - INTERVAL '4 days 14 hours'),
    ('c0000043-0005-0000-0000-000000000003', 'a0000043-0005-0000-0000-000000000005', v_alice,
     'Oui il a augmenté de 12€/an. Le courrier est sur la table du salon si tu veux vérifier les garanties.',
     NOW() - INTERVAL '4 days 8 hours')
  ON CONFLICT (id) DO NOTHING;

  -- Trier les papiers du salon
  INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
    ('c0000043-0006-0000-0000-000000000001', 'a0000043-0006-0000-0000-000000000006', v_ben,
     'Il y a une pile de courriers non ouverts depuis 2 semaines. On s''y met ce week-end ?',
     NOW() - INTERVAL '1 day 8 hours')
  ON CONFLICT (id) DO NOTHING;

END $$;

COMMIT;

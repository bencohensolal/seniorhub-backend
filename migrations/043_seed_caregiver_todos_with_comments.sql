-- Migration 043: Seed realistic comments on caregiver todos
-- Resolves todo IDs by title (works whether todos were created via app or seed).
-- Skips gracefully if household/members/todos don't exist.

BEGIN;

DO $$
DECLARE
  v_hid  UUID := '04acb333-836e-455d-b2be-685ae0da7f35';
  v_ben  UUID;
  v_alice UUID;
  v_todo_plombier UUID;
  v_todo_freebox  UUID;
  v_todo_pile     UUID;
  v_todo_rampe    UUID;
  v_todo_assurance UUID;
  v_todo_papiers  UUID;
BEGIN
  -- Resolve members
  SELECT id INTO v_ben FROM household_members
    WHERE household_id = v_hid AND email = 'ben.cohen.solal@gmail.com' LIMIT 1;
  SELECT id INTO v_alice FROM household_members
    WHERE household_id = v_hid AND first_name = 'Alice' AND role = 'caregiver' LIMIT 1;

  IF v_ben IS NULL OR v_alice IS NULL THEN
    RAISE NOTICE '043: skipping — demo members not found';
    RETURN;
  END IF;

  -- ═══════════════════════════════════════════════════════════
  -- Ensure todos exist (create only if missing)
  -- ═══════════════════════════════════════════════════════════

  SELECT id INTO v_todo_plombier FROM caregiver_todos WHERE household_id = v_hid AND title = 'Prendre RDV plombier' LIMIT 1;
  IF v_todo_plombier IS NULL THEN
    INSERT INTO caregiver_todos (id, household_id, title, description, priority, status, assigned_to, due_date, created_by, created_at, updated_at)
    VALUES (gen_random_uuid(), v_hid, 'Prendre RDV plombier', 'Le robinet de la cuisine fuit depuis plusieurs jours.', 'high', 'pending', v_ben, CURRENT_DATE + 5, v_alice, NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day')
    RETURNING id INTO v_todo_plombier;
  END IF;

  SELECT id INTO v_todo_freebox FROM caregiver_todos WHERE household_id = v_hid AND title = 'Réparer la Freebox' LIMIT 1;
  IF v_todo_freebox IS NULL THEN
    INSERT INTO caregiver_todos (id, household_id, title, description, priority, status, assigned_to, created_by, created_at, updated_at)
    VALUES (gen_random_uuid(), v_hid, 'Réparer la Freebox', 'La télé ne fonctionne plus depuis dimanche.', 'normal', 'in_progress', v_alice, v_ben, NOW() - INTERVAL '3 days', NOW() - INTERVAL '6 hours')
    RETURNING id INTO v_todo_freebox;
  END IF;

  SELECT id INTO v_todo_pile FROM caregiver_todos WHERE household_id = v_hid AND title = 'Acheter pile détecteur de fumée' LIMIT 1;
  IF v_todo_pile IS NULL THEN
    INSERT INTO caregiver_todos (id, household_id, title, description, priority, status, assigned_to, due_date, completed_at, completed_by, created_by, created_at, updated_at)
    VALUES (gen_random_uuid(), v_hid, 'Acheter pile détecteur de fumée', 'Le détecteur bipe en continu, pile 9V à remplacer.', 'high', 'completed', v_alice, CURRENT_DATE - 3, NOW() - INTERVAL '4 days', v_alice, v_ben, NOW() - INTERVAL '7 days', NOW() - INTERVAL '4 days')
    RETURNING id INTO v_todo_pile;
  END IF;

  SELECT id INTO v_todo_rampe FROM caregiver_todos WHERE household_id = v_hid AND title LIKE 'Commander rampe%' LIMIT 1;
  IF v_todo_rampe IS NULL THEN
    INSERT INTO caregiver_todos (id, household_id, title, description, priority, status, assigned_to, due_date, created_by, created_at, updated_at)
    VALUES (gen_random_uuid(), v_hid, 'Commander rampe d''accès salle de bain', 'Recommandation du kiné pour sécuriser la salle de bain.', 'normal', 'pending', v_alice, CURRENT_DATE + 10, v_ben, NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days')
    RETURNING id INTO v_todo_rampe;
  END IF;

  SELECT id INTO v_todo_assurance FROM caregiver_todos WHERE household_id = v_hid AND title LIKE 'Renouveler assurance%' LIMIT 1;
  IF v_todo_assurance IS NULL THEN
    INSERT INTO caregiver_todos (id, household_id, title, description, priority, status, assigned_to, due_date, created_by, created_at, updated_at)
    VALUES (gen_random_uuid(), v_hid, 'Renouveler assurance habitation', 'Contrat MAIF expire fin avril, courrier reçu.', 'normal', 'pending', v_ben, CURRENT_DATE + 15, v_alice, NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days')
    RETURNING id INTO v_todo_assurance;
  END IF;

  SELECT id INTO v_todo_papiers FROM caregiver_todos WHERE household_id = v_hid AND title LIKE 'Trier les papiers%' LIMIT 1;
  IF v_todo_papiers IS NULL THEN
    INSERT INTO caregiver_todos (id, household_id, title, description, priority, status, created_by, created_at, updated_at)
    VALUES (gen_random_uuid(), v_hid, 'Trier les papiers du salon', 'Pile de courriers non ouverts depuis 2 semaines.', 'low', 'pending', v_ben, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days')
    RETURNING id INTO v_todo_papiers;
  END IF;

  -- ═══════════════════════════════════════════════════════════
  -- Comments (skip if already present for this todo)
  -- ═══════════════════════════════════════════════════════════

  -- Prendre RDV plombier
  IF NOT EXISTS (SELECT 1 FROM caregiver_todo_comments WHERE todo_id = v_todo_plombier LIMIT 1) THEN
    INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
      (gen_random_uuid(), v_todo_plombier, v_alice, 'Le robinet de la cuisine fuit de plus en plus, il faudrait vraiment s''en occuper rapidement.', NOW() - INTERVAL '4 days 6 hours'),
      (gen_random_uuid(), v_todo_plombier, v_ben,   'J''ai essayé d''appeler Dupuis Plomberie ce matin, pas de réponse. Je retente demain.', NOW() - INTERVAL '3 days 20 hours'),
      (gen_random_uuid(), v_todo_plombier, v_alice, 'Sinon on peut essayer SOS Dépannage, ma voisine les a appelés et ils sont venus en 48h.', NOW() - INTERVAL '3 days 14 hours'),
      (gen_random_uuid(), v_todo_plombier, v_ben,   'Bonne idée, tu as leur numéro ? En attendant j''ai mis une bassine sous le robinet.', NOW() - INTERVAL '3 days 8 hours');
  END IF;

  -- Réparer la Freebox
  IF NOT EXISTS (SELECT 1 FROM caregiver_todo_comments WHERE todo_id = v_todo_freebox LIMIT 1) THEN
    INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
      (gen_random_uuid(), v_todo_freebox, v_ben,   'Hélène dit que la télé ne marche plus depuis dimanche. J''ai vérifié les câbles, tout semble branché.', NOW() - INTERVAL '2 days 18 hours'),
      (gen_random_uuid(), v_todo_freebox, v_alice, 'J''ai appelé Free, ils disent de débrancher la box 2 minutes puis rebrancher. Je passe essayer ce soir.', NOW() - INTERVAL '2 days 10 hours'),
      (gen_random_uuid(), v_todo_freebox, v_alice, 'Redémarrage fait, ça remarche ! Par contre la télécommande ne fonctionne plus, je change les piles demain.', NOW() - INTERVAL '1 day 22 hours'),
      (gen_random_uuid(), v_todo_freebox, v_ben,   'Super merci Alice ! Les piles sont dans le tiroir de la cuisine côté fenêtre.', NOW() - INTERVAL '1 day 20 hours');
  END IF;

  -- Acheter pile détecteur de fumée
  IF NOT EXISTS (SELECT 1 FROM caregiver_todo_comments WHERE todo_id = v_todo_pile LIMIT 1) THEN
    INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
      (gen_random_uuid(), v_todo_pile, v_ben,   'Le détecteur bipe toutes les 30 secondes, ça stresse Yves. Tu sais quel type de pile il faut ?', NOW() - INTERVAL '6 days'),
      (gen_random_uuid(), v_todo_pile, v_alice, 'C''est une pile 9V carrée. J''en achète demain en passant à Leroy Merlin.', NOW() - INTERVAL '5 days 18 hours'),
      (gen_random_uuid(), v_todo_pile, v_alice, 'C''est fait ! Pile changée, j''ai aussi testé le bouton, tout fonctionne.', NOW() - INTERVAL '4 days 10 hours');
  END IF;

  -- Commander rampe d'accès salle de bain
  IF NOT EXISTS (SELECT 1 FROM caregiver_todo_comments WHERE todo_id = v_todo_rampe LIMIT 1) THEN
    INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
      (gen_random_uuid(), v_todo_rampe, v_ben,   'Le kiné de Hélène recommande une barre d''appui aussi pour les toilettes, on pourrait commander les deux.', NOW() - INTERVAL '3 days 12 hours'),
      (gen_random_uuid(), v_todo_rampe, v_alice, 'J''ai trouvé un kit complet sur Amazon (rampe + barre WC) à 89€ avec de bonnes notes.', NOW() - INTERVAL '2 days 22 hours'),
      (gen_random_uuid(), v_todo_rampe, v_ben,   'Parfait, commande-le. On demandera à Lucas s''il peut passer pour l''installer samedi.', NOW() - INTERVAL '2 days 16 hours');
  END IF;

  -- Renouveler assurance habitation
  IF NOT EXISTS (SELECT 1 FROM caregiver_todo_comments WHERE todo_id = v_todo_assurance LIMIT 1) THEN
    INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
      (gen_random_uuid(), v_todo_assurance, v_alice, 'Le contrat expire fin avril, on a reçu un courrier de la MAIF avec la proposition de renouvellement.', NOW() - INTERVAL '5 days'),
      (gen_random_uuid(), v_todo_assurance, v_ben,   'OK je m''en occupe. Tu sais si le montant a changé par rapport à l''année dernière ?', NOW() - INTERVAL '4 days 14 hours'),
      (gen_random_uuid(), v_todo_assurance, v_alice, 'Oui il a augmenté de 12€/an. Le courrier est sur la table du salon si tu veux vérifier les garanties.', NOW() - INTERVAL '4 days 8 hours');
  END IF;

  -- Trier les papiers du salon
  IF NOT EXISTS (SELECT 1 FROM caregiver_todo_comments WHERE todo_id = v_todo_papiers LIMIT 1) THEN
    INSERT INTO caregiver_todo_comments (id, todo_id, author_id, content, created_at) VALUES
      (gen_random_uuid(), v_todo_papiers, v_ben, 'Il y a une pile de courriers non ouverts depuis 2 semaines. On s''y met ce week-end ?', NOW() - INTERVAL '1 day 8 hours');
  END IF;

END $$;

COMMIT;

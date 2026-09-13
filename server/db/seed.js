import bcrypt from 'bcrypt';
import { transaction } from './index.ts';

async function seed() {
  console.log('🌱 Seeding database...\n');

  try {
    await transaction(async (client) => {
      // Clean assessment data so the seed is repeatable
      await client.query(`
        TRUNCATE TABLE
          notifications,
          task_status_history,
          activity_logs,
          tasks,
          projects,
          clients,
          refresh_tokens,
          users
        RESTART IDENTITY CASCADE
      `);

      const passwordHash = await bcrypt.hash('password123', 12);

      // --------------------------------------------------
      // USERS
      // --------------------------------------------------
      const users = {};

      const userData = [
        ['Admin User', 'admin@example.com', 'ADMIN'],
        ['Priya Manager', 'priya.pm@example.com', 'PROJECT_MANAGER'],
        ['Arjun Manager', 'arjun.pm@example.com', 'PROJECT_MANAGER'],
        ['Ravi Developer', 'ravi.dev@example.com', 'DEVELOPER'],
        ['Neha Developer', 'neha.dev@example.com', 'DEVELOPER'],
        ['Amit Developer', 'amit.dev@example.com', 'DEVELOPER'],
        ['Sneha Developer', 'sneha.dev@example.com', 'DEVELOPER']
      ];

      for (const [name, email, role] of userData) {
        const result = await client.query(
          `INSERT INTO users (name, email, password_hash, role)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, email, role`,
          [name, email, passwordHash, role]
        );

        users[email] = result.rows[0];
      }

      console.log('✓ Created 1 Admin, 2 Project Managers, 4 Developers');

      // --------------------------------------------------
      // CLIENTS
      // --------------------------------------------------
      const clients = {};

      const clientData = [
        ['Acme Corporation', 'contact@acme.test', 'Acme Corp', '+91-9000000001'],
        ['TechNova Solutions', 'hello@technova.test', 'TechNova', '+91-9000000002'],
        ['GreenLeaf Industries', 'contact@greenleaf.test', 'GreenLeaf', '+91-9000000003']
      ];

      for (const [name, email, company, phone] of clientData) {
        const result = await client.query(
          `INSERT INTO clients (name, email, company, phone)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name`,
          [name, email, company, phone]
        );

        clients[company] = result.rows[0];
      }

      console.log('✓ Created 3 clients');

      // --------------------------------------------------
      // PROJECTS
      // --------------------------------------------------
      const projects = [];

      const projectData = [
        {
          owner: users['priya.pm@example.com'].id,
          client: clients['Acme Corp'].id,
          title: 'Website Redesign',
          description: 'Complete redesign of the corporate website with modern UI/UX.'
        },
        {
          owner: users['priya.pm@example.com'].id,
          client: clients['TechNova'].id,
          title: 'E-Commerce Platform',
          description: 'Build a scalable e-commerce platform with payments and order management.'
        },
        {
          owner: users['arjun.pm@example.com'].id,
          client: clients['GreenLeaf'].id,
          title: 'Analytics Dashboard',
          description: 'Real-time analytics dashboard for business intelligence and reporting.'
        }
      ];

      for (const project of projectData) {
        const result = await client.query(
          `INSERT INTO projects
             (owner_id, title, description, client_id, created_by)
           VALUES ($1, $2, $3, $4, $1)
           RETURNING id, title`,
          [
            project.owner,
            project.title,
            project.description,
            project.client
          ]
        );

        projects.push({
          id: result.rows[0].id,
          title: result.rows[0].title,
          owner: project.owner
        });
      }

      console.log('✓ Created 3 projects');

      // --------------------------------------------------
      // TASKS
      // --------------------------------------------------
      const developers = [
        users['ravi.dev@example.com'].id,
        users['neha.dev@example.com'].id,
        users['amit.dev@example.com'].id,
        users['sneha.dev@example.com'].id
      ];

      const taskTemplates = [
        {
          title: 'Create project wireframes',
          description: 'Prepare initial wireframes and layout structure.',
          status: 'DONE',
          priority: 'HIGH',
          developer: developers[0],
          dueDays: -10
        },
        {
          title: 'Design responsive UI',
          description: 'Implement responsive desktop and mobile UI.',
          status: 'IN_PROGRESS',
          priority: 'CRITICAL',
          developer: developers[1],
          dueDays: -2
        },
        {
          title: 'Implement authentication',
          description: 'Implement secure login, JWT and refresh token flow.',
          status: 'IN_REVIEW',
          priority: 'HIGH',
          developer: developers[2],
          dueDays: 2
        },
        {
          title: 'Build dashboard',
          description: 'Develop dashboard components and analytics cards.',
          status: 'TODO',
          priority: 'MEDIUM',
          developer: developers[3],
          dueDays: 5
        },
        {
          title: 'Write API documentation',
          description: 'Document REST API endpoints and request/response formats.',
          status: 'TODO',
          priority: 'LOW',
          developer: developers[0],
          dueDays: 10
        },
        {
          title: 'Add database indexes',
          description: 'Review query performance and add required indexes.',
          status: 'DONE',
          priority: 'MEDIUM',
          developer: developers[1],
          dueDays: -15
        }
      ];

      let taskCount = 0;
      let activityCount = 0;
      let historyCount = 0;
      let notificationCount = 0;

      for (const project of projects) {
        for (let i = 0; i < taskTemplates.length; i++) {
          const template = taskTemplates[i];

          const createdAt = new Date(
            Date.now() - (20 - i * 2) * 24 * 60 * 60 * 1000
          );

          const dueDate = new Date(
            Date.now() + template.dueDays * 24 * 60 * 60 * 1000
          );

          let startedAt = null;
          let completedAt = null;

          if (
            template.status === 'IN_PROGRESS' ||
            template.status === 'IN_REVIEW' ||
            template.status === 'DONE'
          ) {
            startedAt = new Date(
              createdAt.getTime() + 2 * 60 * 60 * 1000
            );
          }

          if (template.status === 'DONE') {
            completedAt = new Date(
              createdAt.getTime() + 24 * 60 * 60 * 1000
            );
          }

          const isOverdue =
            template.status !== 'DONE' &&
            dueDate.getTime() < Date.now();

          const taskResult = await client.query(
            `INSERT INTO tasks (
              project_id,
              title,
              description,
              status,
              priority,
              created_by,
              created_at,
              updated_at,
              started_at,
              completed_at,
              assigned_developer_id,
              due_date,
              is_overdue
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12)
            RETURNING id`,
            [
              project.id,
              template.title,
              template.description,
              template.status,
              template.priority,
              project.owner,
              createdAt,
              startedAt,
              completedAt,
              template.developer,
              dueDate,
              isOverdue
            ]
          );

          const taskId = taskResult.rows[0].id;
          taskCount++;

          // ------------------------------------------------
          // ACTIVITY LOG
          // ------------------------------------------------
          await client.query(
            `INSERT INTO activity_logs
              (user_id, project_id, task_id, action, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              template.developer,
              project.id,
              taskId,
              'task_created',
              JSON.stringify({
                title: template.title,
                status: template.status,
                priority: template.priority
              }),
              createdAt
            ]
          );

          activityCount++;

          // ------------------------------------------------
          // STATUS HISTORY
          // ------------------------------------------------
          if (template.status !== 'TODO') {
            await client.query(
              `INSERT INTO task_status_history
                (task_id, changed_by, from_status, to_status, changed_at)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                taskId,
                template.developer,
                'TODO',
                template.status,
                new Date(createdAt.getTime() + 2 * 60 * 60 * 1000)
              ]
            );

            historyCount++;
          }

          // ------------------------------------------------
          // DEVELOPER ASSIGNMENT NOTIFICATION
          // ------------------------------------------------
          await client.query(
            `INSERT INTO notifications
              (user_id, type, title, message, project_id, task_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              template.developer,
              'TASK_ASSIGNED',
              'Task Assigned',
              `You have been assigned "${template.title}"`,
              project.id,
              taskId
            ]
          );

          notificationCount++;

          // ------------------------------------------------
          // PM NOTIFICATION FOR IN_REVIEW
          // ------------------------------------------------
          if (template.status === 'IN_REVIEW') {
            await client.query(
              `INSERT INTO notifications
                (user_id, type, title, message, project_id, task_id)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                project.owner,
                'TASK_IN_REVIEW',
                'Task Ready for Review',
                `"${template.title}" has been moved to In Review`,
                project.id,
                taskId
              ]
            );

            notificationCount++;
          }
        }
      }

      console.log(`✓ Created ${taskCount} tasks`);
      console.log(`✓ Created ${activityCount} activity logs`);
      console.log(`✓ Created ${historyCount} status history records`);
      console.log(`✓ Created ${notificationCount} notifications`);
    });

    console.log('\n✅ Database seeded successfully!\n');

    console.log('Test credentials:');
    console.log('--------------------------------------------');
    console.log('Admin:');
    console.log('  admin@example.com / password123');
    console.log('');
    console.log('Project Managers:');
    console.log('  priya.pm@example.com / password123');
    console.log('  arjun.pm@example.com / password123');
    console.log('');
    console.log('Developers:');
    console.log('  ravi.dev@example.com / password123');
    console.log('  neha.dev@example.com / password123');
    console.log('  amit.dev@example.com / password123');
    console.log('  sneha.dev@example.com / password123');
    console.log('--------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();

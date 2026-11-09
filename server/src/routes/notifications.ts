import { Router, Request, Response } from 'express';
import { query, withWallet } from '../db.js';
import { authenticateWallet } from '../auth.js';

export const notificationsRouter = Router();

/**
 * List unread or all notifications for authenticated user
 */
notificationsRouter.get('/', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const wallet = req.wallet!;
    const result = await withWallet(wallet, async (client) => {
      return client.query(
        `SELECT * FROM notifications
         WHERE recipient_wallet = $1
         ORDER BY created_at DESC LIMIT 50`,
        [wallet]
      );
    });

    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * Mark a single notification as read
 */
notificationsRouter.patch('/:id/read', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const wallet = req.wallet!;
    const { id } = req.params;

    const result = await withWallet(wallet, async (client) => {
      return client.query(
        `UPDATE notifications
         SET read = true
         WHERE id = $1 AND recipient_wallet = $2
         RETURNING *`,
        [id, wallet]
      );
    });

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ notification: result.rows[0] });
  } catch (err) {
    console.error('Update notification error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

/**
 * Mark all notifications as read
 */
notificationsRouter.post('/read-all', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const wallet = req.wallet!;
    await withWallet(wallet, async (client) => {
      return client.query(
        `UPDATE notifications
         SET read = true
         WHERE recipient_wallet = $1`,
        [wallet]
      );
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Read all notifications error:', err);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});


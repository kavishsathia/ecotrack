'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Settings,
  User,
  Bell,
  Link as LinkIcon,
  Unlink,
  MessageCircle,
  Shield,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  Bot,
  Smartphone,
} from 'lucide-react';

interface TelegramLinkStatus {
  linked: boolean;
  telegramId?: string;
  telegramUsername?: string;
  linkedAt?: string;
}

interface NotificationSettings {
  lifecycleEvents: boolean;
  priceAlerts: boolean;
  sustainabilityUpdates: boolean;
  weeklyReports: boolean;
  telegramNotifications: boolean;
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<TelegramLinkStatus>({ linked: false });
  const [telegramIdInput, setTelegramIdInput] = useState('');
  const [notifications, setNotifications] = useState<NotificationSettings>({
    lifecycleEvents: true,
    priceAlerts: true,
    sustainabilityUpdates: true,
    weeklyReports: false,
    telegramNotifications: false,
  });
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      checkTelegramStatus();
      loadNotificationSettings();
    }
  }, [user]);

  const checkTelegramStatus = async () => {
    try {
      if (user?.telegramId) {
        setTelegramStatus({
          linked: true,
          telegramId: user.telegramId,
          telegramUsername: user.telegramUsername || undefined,
          linkedAt: user.telegramLinkedAt || undefined,
        });
      }
    } catch (error) {
      console.error('Error checking Telegram status:', error);
    }
  };

  const loadNotificationSettings = () => {
    // Load from localStorage or API
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
      setNotifications(JSON.parse(saved));
    }
  };

  const saveNotificationSettings = async (newSettings: NotificationSettings) => {
    try {
      setNotifications(newSettings);
      localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
      showSuccess('Notification settings updated');
    } catch (error) {
      showError('Failed to save notification settings');
    }
  };

  const linkTelegramAccount = async () => {
    if (!telegramIdInput.trim()) {
      showError('Please enter your Telegram ID');
      return;
    }

    if (!user) {
      showError('User not found');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: telegramIdInput.trim(),
          userId: user.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTelegramStatus({
          linked: true,
          telegramId: telegramIdInput.trim(),
          linkedAt: new Date().toISOString(),
        });
        setTelegramIdInput('');
        await refreshUser();
        showSuccess('Telegram account linked successfully!');
      } else {
        showError(result.message || 'Failed to link Telegram account');
      }
    } catch (error) {
      console.error('Error linking Telegram:', error);
      showError('Failed to link Telegram account');
    } finally {
      setLoading(false);
    }
  };

  const unlinkTelegramAccount = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/telegram/link?userId=${user.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setTelegramStatus({ linked: false });
        await refreshUser();
        showSuccess('Telegram account unlinked successfully');
      } else {
        showError('Failed to unlink Telegram account');
      }
    } catch (error) {
      console.error('Error unlinking Telegram:', error);
      showError('Failed to unlink Telegram account');
    } finally {
      setLoading(false);
    }
  };

  const copyTelegramId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      showSuccess('User ID copied to clipboard');
    }
  };

  const showSuccess = (message: string) => {
    setSuccess(message);
    setError(null);
    setTimeout(() => setSuccess(null), 5000);
  };

  const showError = (message: string) => {
    setError(message);
    setSuccess(null);
    setTimeout(() => setError(null), 5000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-1">
              Manage your account, notifications, and integrations
            </p>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            <Settings className="mr-1 h-3 w-3" />
            Account Settings
          </Badge>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Profile Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <Input value={user?.name || ''} disabled />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input value={user?.email || ''} disabled />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID
              </label>
              <div className="flex items-center space-x-2">
                <Input value={user?.id || ''} disabled />
                <Button variant="outline" size="sm" onClick={copyTelegramId}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Use this ID when linking your Telegram account
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Telegram Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5" />
              <span>Telegram Integration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {telegramStatus.linked ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">Telegram Account Linked</p>
                      <p className="text-sm text-green-700">
                        ID: {telegramStatus.telegramId}
                        {telegramStatus.telegramUsername && (
                          <span> • @{telegramStatus.telegramUsername}</span>
                        )}
                      </p>
                      {telegramStatus.linkedAt && (
                        <p className="text-xs text-green-600">
                          Linked on {new Date(telegramStatus.linkedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={unlinkTelegramAccount}
                    disabled={loading}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Unlink className="mr-2 h-4 w-4" />
                    Unlink
                  </Button>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-start space-x-3">
                    <Bot className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">Bot Usage Instructions</p>
                      <div className="text-sm text-blue-800 mt-2 space-y-1">
                        <p>• Send photos of your products with descriptions</p>
                        <p>• Use commands like /status, /products, /help</p>
                        <p>• Report lifecycle events: "My laptop is broken", "Fixed my phone"</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 text-blue-700 border-blue-300"
                        onClick={() => window.open('https://t.me/your_bot_username', '_blank')}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Bot in Telegram
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-900">Telegram Account Not Linked</p>
                      <p className="text-sm text-yellow-800 mt-1">
                        Link your Telegram account to track product lifecycle events via our bot
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telegram User ID
                    </label>
                    <div className="flex items-center space-x-2">
                      <Input
                        placeholder="Enter your Telegram user ID"
                        value={telegramIdInput}
                        onChange={(e) => setTelegramIdInput(e.target.value)}
                      />
                      <Button
                        onClick={linkTelegramAccount}
                        disabled={loading || !telegramIdInput.trim()}
                        className="bg-teal-600 hover:bg-teal-700"
                      >
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Link Account
                      </Button>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="font-medium text-gray-900 mb-2">How to find your Telegram ID:</p>
                    <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                      <li>Open Telegram and search for "@userinfobot"</li>
                      <li>Start a chat with the bot</li>
                      <li>Send any message to the bot</li>
                      <li>The bot will reply with your user ID</li>
                      <li>Copy the ID and paste it above</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Notification Preferences</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Lifecycle Events</p>
                  <p className="text-sm text-gray-600">Get notified when products have lifecycle updates</p>
                </div>
                <Switch
                  checked={notifications.lifecycleEvents}
                  onCheckedChange={(checked) =>
                    saveNotificationSettings({ ...notifications, lifecycleEvents: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Price Alerts</p>
                  <p className="text-sm text-gray-600">Notifications for significant price changes</p>
                </div>
                <Switch
                  checked={notifications.priceAlerts}
                  onCheckedChange={(checked) =>
                    saveNotificationSettings({ ...notifications, priceAlerts: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Sustainability Updates</p>
                  <p className="text-sm text-gray-600">Updates when eco-scores or certifications change</p>
                </div>
                <Switch
                  checked={notifications.sustainabilityUpdates}
                  onCheckedChange={(checked) =>
                    saveNotificationSettings({ ...notifications, sustainabilityUpdates: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Weekly Reports</p>
                  <p className="text-sm text-gray-600">Weekly summary of your sustainability progress</p>
                </div>
                <Switch
                  checked={notifications.weeklyReports}
                  onCheckedChange={(checked) =>
                    saveNotificationSettings({ ...notifications, weeklyReports: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Telegram Notifications</p>
                  <p className="text-sm text-gray-600">
                    Receive notifications via Telegram bot
                    {!telegramStatus.linked && (
                      <span className="text-yellow-600"> (requires linked account)</span>
                    )}
                  </p>
                </div>
                <Switch
                  checked={notifications.telegramNotifications && telegramStatus.linked}
                  onCheckedChange={(checked) =>
                    saveNotificationSettings({ ...notifications, telegramNotifications: checked })
                  }
                  disabled={!telegramStatus.linked}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data & Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Data & Privacy</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" className="justify-start">
                <Download className="mr-2 h-4 w-4" />
                Export My Data
              </Button>
              <Button variant="outline" className="justify-start text-red-600 border-red-200 hover:bg-red-50">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </div>
            <div className="text-sm text-gray-600 space-y-2">
              <p>• Your data is processed according to our Privacy Policy</p>
              <p>• Lifecycle events and product data are stored securely</p>
              <p>• You can export or delete your data at any time</p>
              <p>• Telegram integration is optional and can be disabled</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
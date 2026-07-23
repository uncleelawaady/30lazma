# VPS SSH Connectivity Troubleshooting Guide

**Issue**: SSH connection to 2.24.15.245:22 times out
**Status**: ⏳ Unresolved - requires Hostinger console access

## Current Diagnosis

```
ssh: connect to host 2.24.15.245 port 22: Connection timed out
```

This indicates one of:
1. SSH service not running on VPS
2. Firewall blocking port 22 inbound
3. Network misconfiguration
4. VPS offline or in maintenance

## Resolution Steps (via Hostinger Console)

You have access to the Hostinger VPS console directly. Use it to execute these commands:

### Step 1: Verify SSH Service Status

```bash
sudo systemctl status ssh
# or
sudo systemctl status sshd
```

**If service is inactive:**
```bash
sudo systemctl start ssh
sudo systemctl start sshd
sudo systemctl enable ssh
```

### Step 2: Check Firewall Rules

```bash
# Check if UFW is enabled
sudo ufw status

# If enabled, verify SSH port is allowed
sudo ufw allow 22/tcp

# Check current rules
sudo iptables -L -n | grep 22
```

### Step 3: Verify SSH Configuration

```bash
# Check SSH config
sudo cat /etc/ssh/sshd_config | grep -E "Port|PasswordAuthentication|PubkeyAuthentication"

# Common fix: Enable password authentication
sudo sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

### Step 4: Check Network Interface

```bash
# Verify IP is active
ip addr show
ifconfig

# Check if network service is running
sudo systemctl status networking
sudo systemctl restart networking
```

### Step 5: Review SSH Logs

```bash
# Check for connection attempts
sudo tail -50 /var/log/auth.log | grep ssh

# Check system logs
sudo journalctl -u ssh -n 30

# Check syslog
sudo tail -50 /var/log/syslog
```

## Quick Fix Script (run on Hostinger console)

Save this as `fix_ssh.sh` and execute:

```bash
#!/bin/bash
echo "🔧 Fixing SSH connectivity..."

# Enable SSH service
echo "1. Enabling SSH service..."
sudo systemctl start ssh 2>/dev/null || sudo systemctl start sshd 2>/dev/null
sudo systemctl enable ssh 2>/dev/null || sudo systemctl enable sshd 2>/dev/null

# Enable password authentication
echo "2. Enabling password authentication..."
sudo sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Restart SSH
echo "3. Restarting SSH..."
sudo systemctl restart ssh 2>/dev/null || sudo systemctl restart sshd 2>/dev/null

# Fix firewall
echo "4. Configuring firewall..."
sudo ufw allow 22/tcp 2>/dev/null

# Verify
echo "5. Verifying..."
sudo systemctl is-active --quiet ssh || sudo systemctl is-active --quiet sshd
if [ $? -eq 0 ]; then
    echo "✅ SSH service is now running"
else
    echo "❌ SSH service still not active"
    exit 1
fi

echo "✅ SSH fixes applied successfully"
```

## Direct Hostinger Console Access

If above steps don't work, use Hostinger console directly:

1. Log in to Hostinger Control Panel
2. Go to **VPS** → **Your VPS** → **Management** → **Console**
3. Execute the commands directly

## Once SSH is Working

After SSH connectivity is restored, deployment is automated:

```bash
# From your local machine
ssh root@2.24.15.245

# Then execute deployment
cd /root
bash deploy_enhanced_bot.sh
```

## Alternative: Direct Console Deployment

If SSH remains problematic, deploy via Hostinger console:

1. Upload bot_dev files via Hostinger File Manager or SCP
2. Execute in console:
   ```bash
   cd /root
   python3 << 'EOF'
   from bot_dev.database import init_db
   init_db()
   print("Database initialized")
   EOF
   
   cp bot_dev/enhanced_bot.py exd_downloader_bot/bot.py
   pip3 install -r bot_dev/requirements.txt
   systemctl restart exd_downloader_bot.service
   ```

## Verification After Fix

Once SSH works:

```bash
# Connect
ssh root@2.24.15.245

# Verify connection
echo "✅ SSH connection successful"

# Check current bot status
systemctl status exd_downloader_bot.service

# View bot location
ls -la /root/exd_downloader_bot/
```

## Network Diagnostic Commands

If still having issues, run these to diagnose:

```bash
# Test network connectivity
ping 8.8.8.8

# Check listening ports
sudo netstat -tlnp | grep :22
sudo ss -tlnp | grep :22

# DNS resolution
nslookup 2.24.15.245
dig 2.24.15.245

# Route information
ip route show
route -n

# Check network interfaces
ip link show
```

## Contact Hostinger Support

If above steps fail:

1. Contact Hostinger Support with:
   - VPS IP: 2.24.15.245
   - Issue: "SSH port 22 not responding"
   - Steps taken: List the fix attempts above

2. Request:
   - SSH port status
   - Firewall configuration
   - Server power status
   - Network diagnostics

## Temporary Workaround

Until SSH is fixed, you can:

1. Use Hostinger File Manager to upload files
2. Use Hostinger Console to execute commands
3. Deploy via console without SSH

---

## Summary

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Connection timed out | SSH not running | `sudo systemctl start ssh` |
| Connection refused | SSH running but wrong config | Check sshd_config |
| Connection reset | Firewall blocking | `sudo ufw allow 22/tcp` |
| No route to host | Network down | Check `ip link show` |

**Status**: Ready to deploy immediately after SSH is accessible

---

**Contact**: elawadi.store4@gmail.com

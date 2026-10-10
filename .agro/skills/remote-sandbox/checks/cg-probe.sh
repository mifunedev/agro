set -u
cg() { echo "-- $1: root=$(cat /sys/fs/cgroup/cgroup.type) sub=[$(cat /sys/fs/cgroup/cgroup.subtree_control)]"; for d in /sys/fs/cgroup/*/; do echo "   $d $(cat $d/cgroup.type 2>&1)"; done; }
cg boot
curl -fsSL https://get.docker.com | sudo sh >/tmp/di.log 2>&1
cg after-install
sudo setsid nohup dockerd >/tmp/dockerd.log 2>&1 </dev/null &
for i in $(seq 30); do sudo docker info >/dev/null 2>&1 && break; sleep 2; done
cg after-dockerd
sudo pkill dockerd; sleep 4; sudo pkill containerd; sleep 2
for d in /sys/fs/cgroup/*/; do sudo rmdir "$d" 2>&1; done
cg after-rmdir
for c in memory io cpu pids; do echo "+$c" | sudo tee /sys/fs/cgroup/cgroup.subtree_control >/dev/null 2>/tmp/e && echo "$c ok" || echo "$c FAIL $(cat /tmp/e)"; done
sudo mkdir /sys/fs/cgroup/agro && echo "agro type=$(cat /sys/fs/cgroup/agro/cgroup.type)"
cg after-enable
sudo setsid nohup dockerd --cgroup-parent=/agro >/tmp/dockerd2.log 2>&1 </dev/null &
for i in $(seq 30); do sudo docker info >/dev/null 2>&1 && break; sleep 2; done
sudo docker run -d --name sd --cgroupns=private --cap-add SYS_ADMIN --security-opt apparmor=unconfined --tmpfs /run --tmpfs /run/lock --tmpfs /sys/fs jrei/systemd-ubuntu:24.04 >/dev/null 2>&1
sleep 20
echo "sd: $(sudo docker inspect -f '{{.State.Status}} restarts={{.RestartCount}}' sd)"
sudo docker exec sd systemctl is-system-running 2>&1
sudo docker logs sd 2>&1 | grep -iE 'fail|structure|welcome' | head -5
cg final
echo PROBE-END

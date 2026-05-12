import { Component, OnInit, OnDestroy } from '@angular/core';
import { DataService } from '../services/data.service';
import { Item } from '../models/item.model';
import { ModalController, ToastController } from '@ionic/angular';
import { LocalNotifications } from '@capacitor/local-notifications';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  items: Item[] = [];
  savedMoney: number = 0;
  
  segment: 'cooling' | 'history' = 'cooling';
  searchTerm: string = '';
  filterPriority: string = 'all';

  newItem = {
    name: '',
    price: null as number | null,
    priority: 'medium' as 'low' | 'medium' | 'high',
    cooldownValue: 1,
    cooldownUnit: 'days' as 'minutes' | 'hours' | 'days'
  };
  
  isModalOpen = false;
  private updateInterval: any;

  constructor(
    private dataService: DataService,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    this.dataService.items$.subscribe(data => {
      this.items = data.sort((a, b) => b.createdAt - a.createdAt);
    });
    this.dataService.totalSaved$.subscribe(total => {
      this.savedMoney = total;
    });

    // Request notification permissions for Web/PWA
    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    } catch (e) {
      console.log('Notifications not supported on this browser');
    }

    // Update progress bars and remaining time every 10 seconds
    this.updateInterval = setInterval(() => {
    }, 10000);
  }

  ngOnDestroy() {
    if (this.updateInterval) clearInterval(this.updateInterval);
  }

  setOpen(isOpen: boolean) {
    this.isModalOpen = isOpen;
  }

  async addItem() {
    if (!this.newItem.name || !this.newItem.price || this.newItem.price <= 0) {
      const toast = await this.toastCtrl.create({
        message: 'Mohon isi nama dan harga dengan benar!',
        duration: 2000,
        color: 'warning',
        position: 'top'
      });
      toast.present();
      return;
    }

    const now = new Date();
    let multiplier = 24 * 60 * 60 * 1000;
    if (this.newItem.cooldownUnit === 'minutes') multiplier = 60 * 1000;
    if (this.newItem.cooldownUnit === 'hours') multiplier = 60 * 60 * 1000;

    const cooldownDate = new Date(now.getTime() + this.newItem.cooldownValue * multiplier);

    const item: Item = {
      id: Date.now().toString(),
      name: this.newItem.name,
      price: this.newItem.price,
      priority: this.newItem.priority,
      createdAt: now.getTime(),
      cooldownUntil: cooldownDate.getTime(),
      status: 'cooling'
    };

    await this.dataService.addItem(item);
    
    this.newItem = {
      name: '',
      price: null,
      priority: 'medium',
      cooldownValue: 1,
      cooldownUnit: 'days'
    };
    this.setOpen(false);

    const toast = await this.toastCtrl.create({
      message: 'Barang berhasil ditambahkan!',
      duration: 2000,
      color: 'success',
      position: 'top'
    });
    toast.present();
  }

  get filteredItems() {
    return this.items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesFilter = this.filterPriority === 'all' || item.priority === this.filterPriority;
      return matchesSearch && matchesFilter;
    });
  }

  get coolingItems() {
    return this.filteredItems.filter(i => i.status === 'cooling');
  }

  get historyItems() {
    return this.filteredItems.filter(i => i.status !== 'cooling');
  }

  get historyStats() {
    const history = this.items.filter(i => i.status !== 'cooling');
    const total = history.length;
    if (total === 0) return null;
    
    const bought = history.filter(i => i.status === 'bought').length;
    const canceled = history.filter(i => i.status === 'canceled').length;
    
    return {
      bought: Math.round((bought / total) * 100),
      canceled: Math.round((canceled / total) * 100),
      totalSaved: this.savedMoney
    };
  }

  isCooldownDone(item: Item): boolean {
    return new Date().getTime() >= item.cooldownUntil;
  }

  async makeDecision(id: string, status: 'bought' | 'canceled') {
    await this.dataService.updateItemStatus(id, status);
  }
  
  async deleteItem(id: string) {
    await this.dataService.deleteItem(id);
  }

  async clearHistory() {
    const history = this.items.filter(i => i.status !== 'cooling');
    for (const item of history) {
      await this.dataService.deleteItem(item.id);
    }
  }

  getProgress(item: Item): number {
    const total = item.cooldownUntil - item.createdAt;
    const passed = new Date().getTime() - item.createdAt;
    return Math.min(Math.max(passed / total, 0), 1);
  }

  getRemainingTime(item: Item): string {
    const now = new Date().getTime();
    const diff = item.cooldownUntil - now;
    if (diff <= 0) return 'Siap diputuskan!';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days} hari ${hours}j lagi`;
    if (hours > 0) return `${hours}j ${minutes}m lagi`;
    return `${minutes}m lagi`;
  }
}

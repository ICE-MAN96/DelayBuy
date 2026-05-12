import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Item } from '../models/item.model';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private _storage: Storage | null = null;
  public items$ = new BehaviorSubject<Item[]>([]);
  public totalSaved$ = new BehaviorSubject<number>(0);

  constructor(private storage: Storage) {
    this.init();
  }

  async init() {
    const storage = await this.storage.create();
    this._storage = storage;
    
    // Request notification permissions
    try {
      await LocalNotifications.requestPermissions();
    } catch (e) {
      console.log('Push notifications not available on web');
    }

    this.loadData();
  }

  async loadData() {
    const items = await this._storage?.get('items') || [];
    this.items$.next(items);
    this.calculateSaved(items);
  }

  async addItem(item: Item) {
    const items = this.items$.getValue();
    items.push(item);
    await this.saveItems(items);
    
    // Schedule notification
    await this.scheduleNotification(item);
  }

  async updateItemStatus(id: string, status: 'bought' | 'canceled') {
    const items = this.items$.getValue();
    const itemIndex = items.findIndex(i => i.id === id);
    if (itemIndex > -1) {
      items[itemIndex].status = status;
      await this.saveItems(items);
    }
  }

  async deleteItem(id: string) {
    const items = this.items$.getValue();
    const newItems = items.filter(i => i.id !== id);
    await this.saveItems(newItems);
  }

  private async saveItems(items: Item[]) {
    await this._storage?.set('items', items);
    this.items$.next(items);
    this.calculateSaved(items);
  }

  private calculateSaved(items: Item[]) {
    const saved = items.filter(i => i.status === 'canceled').reduce((acc, curr) => acc + curr.price, 0);
    this.totalSaved$.next(saved);
  }

  private async scheduleNotification(item: Item) {
    const scheduleDate = new Date(item.cooldownUntil);
    if (scheduleDate.getTime() <= new Date().getTime()) return;

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Waktu Tunggu Selesai!',
            body: `Waktu pertimbangan untuk "${item.name}" sudah habis. Apa keputusanmu?`,
            id: parseInt(item.id.slice(-8)),
            schedule: { at: scheduleDate },
          }
        ]
      });
    } catch (e) {
      console.log('Notifications not supported in this environment');
    }
  }
}

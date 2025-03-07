import { v4 as uuidv4 } from 'uuid';

export default function (length: number): string {
    const Longid: string = uuidv4();
    const id: string = Longid.substring(0, length);
    return id;
}